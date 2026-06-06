/**
 * Cloudflare Stream — the authenticated + cryptographic operations the app
 * needs. Thumbnail/player URL building (public, customer-code only) lives in
 * `@btc/ui` media helpers, not here.
 *
 *   createDirectUpload — provision a one-time resumable (tus) upload URL
 *   deleteVideo        — remove a video from Stream
 *   signToken          — RS256 JWT for signed (gated) playback
 *   verifyWebhook      — validate the Stream webhook signature
 *
 * The AI ("generated") caption helpers (generateCaptions / getCaptionStatus /
 * fetchCaptionVtt) live in `./client` and are re-exported below; VTT → plain
 * transcript parsing is the consumer's job (see `@/lib/transcript`).
 */

import {
  base64UrlFromBytes,
  base64UrlFromObject,
  signingConfig,
  streamFetch,
} from "./client";

/* ───────────────────────── Generated captions (re-exported) ───────────────────────── */

export {
  type CaptionStatus,
  type CaptionTrack,
  DEFAULT_CAPTION_LANGUAGE,
  fetchCaptionVtt,
  generateCaptions,
  getCaptionStatus,
} from "./client";

/* ───────────────────────── Uploads ───────────────────────── */

export type CreateUploadOptions = {
  /** Byte length of the file the creator is about to upload (tus requires it). */
  uploadLength: number;
  /** Original file name, surfaced in the Stream dashboard. */
  fileName?: string;
  /** Gate the video behind signed URLs (subscribers / one-time purchase). */
  requireSignedURLs?: boolean;
  /** Reject inputs longer than this (defense against abuse). */
  maxDurationSeconds?: number;
  /** Default poster position, 0–1 (e.g. 0.5 = halfway). */
  thumbnailTimestampPct?: number;
};

/**
 * Create a direct creator upload via the tus protocol. Returns the one-time
 * resumable upload URL (the client uploads straight to it, no credentials) and
 * the Stream `uid` — the single, stable identifier for this video.
 */
export async function createDirectUpload(
  opts: CreateUploadOptions,
): Promise<{ uploadUrl: string; uid: string }> {
  const meta: string[] = [];
  const enc = (v: string) => base64UrlFromBytes(new TextEncoder().encode(v));
  if (opts.fileName) meta.push(`name ${enc(opts.fileName)}`);
  // Valueless tus metadata key = boolean true.
  if (opts.requireSignedURLs) meta.push("requiresignedurls");
  if (opts.maxDurationSeconds)
    meta.push(`maxdurationseconds ${enc(String(opts.maxDurationSeconds))}`);
  if (opts.thumbnailTimestampPct != null)
    meta.push(
      `thumbnailtimestamppct ${enc(String(opts.thumbnailTimestampPct))}`,
    );

  const res = await streamFetch("?direct_user=true", {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(opts.uploadLength),
      ...(meta.length ? { "Upload-Metadata": meta.join(",") } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(
      `Stream upload-create failed: ${res.status} ${await res.text()}`,
    );
  }

  const uploadUrl = res.headers.get("Location");
  const uid = res.headers.get("stream-media-id");
  if (!uploadUrl || !uid) {
    throw new Error("Stream did not return a Location / stream-media-id.");
  }
  return { uploadUrl, uid };
}

export async function deleteVideo(uid: string): Promise<void> {
  try {
    await streamFetch(`/${uid}`, { method: "DELETE" });
  } catch {
    // Ignore — the video may already be gone.
  }
}

/**
 * Flip a video's `requireSignedURLs` flag on Cloudflare Stream.
 *
 * This is the Stream half of the paywall enforcement (the DB half is
 * `playbackPolicy`). When `true`, Cloudflare refuses to serve the manifest or
 * thumbnails for the bare `uid` — every request must carry a valid signed
 * token. Setting it is how we make a video that backs a *gated* course's lesson
 * unplayable by anyone who scrapes the uid (the real fix for the bypass).
 *
 * Throws on a non-OK response so the caller can BLOCK the unsafe state (e.g.
 * refuse to publish a gated course) rather than silently persist a public
 * policy in the DB while Stream still serves the raw video. Uses the standard
 * Stream "edit video details" endpoint (`POST /{uid}` with a JSON body).
 */
export async function setRequireSignedURLs(
  uid: string,
  requireSignedURLs: boolean,
): Promise<void> {
  const res = await streamFetch(`/${uid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requireSignedURLs }),
  });
  if (!res.ok) {
    throw new Error(
      `Stream requireSignedURLs update failed for ${uid}: ${res.status} ${await res.text()}`,
    );
  }
}

/* ───────────────────────── Signed playback ───────────────────────── */

/**
 * Sign an RS256 JWT for a gated video. The returned token is used in place of
 * the bare `uid` in player and thumbnail URLs. Signed entirely on the Worker
 * with WebCrypto — no API round-trip. Returns null if signing isn't configured.
 */
export async function signToken(
  uid: string,
  opts: { expiresInSeconds?: number } = {},
): Promise<string | null> {
  const cfg = signingConfig();
  if (!cfg) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expiresInSeconds ?? 12 * 60 * 60);
  const header = { alg: "RS256", kid: cfg.keyId };
  const payload = { sub: uid, kid: cfg.keyId, exp, nbf: now };
  const data = `${base64UrlFromObject(header)}.${base64UrlFromObject(payload)}`;

  const key = await crypto.subtle.importKey(
    "jwk",
    cfg.jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64UrlFromBytes(signature)}`;
}

/* ───────────────────────── Webhooks ───────────────────────── */

/**
 * Verify a Stream webhook. The `Webhook-Signature` header is `time=…,sig1=…`;
 * the signed message is `` `${time}.${rawBody}` `` (HMAC-SHA256, hex). Rejects
 * stale requests (default 5-minute tolerance) to blunt replay attacks.
 */
export async function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const fields: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq > 0) fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  const time = fields.time;
  const sig1 = fields.sig1;
  if (!time || !sig1) return false;

  const age = Math.floor(Date.now() / 1000) - Number(time);
  if (!Number.isFinite(age) || Math.abs(age) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${time}.${rawBody}`),
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, sig1);
}

/** Length-constant string comparison (avoids leaking match position via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
