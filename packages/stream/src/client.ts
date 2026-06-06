/**
 * Cloudflare Stream — server-side configuration and low-level helpers.
 *
 * Everything here runs on the server only (the Worker, seed/setup scripts). It
 * talks to the Stream REST API with a scoped API token and signs playback
 * tokens with WebCrypto — no SDK, no client bundle exposure. The *public*
 * customer code used to build thumbnail/player URLs lives in the UI layer
 * (`@btc/ui` media helpers), not here, so this module never leaks into the
 * browser.
 *
 * Secrets are read lazily (per call), never at module top-level: the Workers
 * runtime only populates `process.env` per-request.
 */

export const STREAM_API_BASE = "https://api.cloudflare.com/client/v4";

export type StreamConfig = { accountId: string; apiToken: string };

/** Account id + API token for authenticated Stream REST calls. */
export function streamConfig(): StreamConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_API_TOKEN.",
    );
  }
  return { accountId, apiToken };
}

export type SigningConfig = { keyId: string; jwk: JsonWebKey };

/**
 * Signing key for gated (signed-URL) playback, or null if not configured.
 * `STREAM_SIGNING_JWK` is the RSA private key in JWK form, base64-encoded JSON
 * (as printed by `scripts/stream-setup.ts`).
 */
export function signingConfig(): SigningConfig | null {
  const keyId = process.env.STREAM_SIGNING_KEY_ID;
  const raw = process.env.STREAM_SIGNING_JWK;
  if (!keyId || !raw) return null;
  return { keyId, jwk: JSON.parse(atob(raw)) as JsonWebKey };
}

/** Authenticated fetch against the account's Stream API. */
export function streamFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { accountId, apiToken } = streamConfig();
  return fetch(`${STREAM_API_BASE}/accounts/${accountId}/stream${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...init.headers,
    },
  });
}

/* ───────────────────────── base64url helpers (JWT signing) ───────────────────────── */

export function base64UrlFromBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const byte of arr) str += String.fromCharCode(byte);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function base64UrlFromObject(value: unknown): string {
  return base64UrlFromBytes(new TextEncoder().encode(JSON.stringify(value)));
}

/* ───────────────────────── Generated captions ───────────────────────── */

/**
 * Default caption language. Cloudflare Stream's AI caption generation expects a
 * BCP-47 language tag; the generated track is also addressed by this tag when
 * fetching the `.vtt`. Single-language by design — multi-language transcription
 * can layer on later by threading a tag through the helpers below.
 */
export const DEFAULT_CAPTION_LANGUAGE = "en";

/** Generation lifecycle for an AI caption track (mirrors the Stream API). */
export type CaptionStatus = "inprogress" | "ready" | "error";

/** One caption track as returned by the list-captions endpoint. */
export type CaptionTrack = {
  language: string;
  label: string;
  /** true for AI-generated tracks, false for manually uploaded ones. */
  generated: boolean;
  status: CaptionStatus;
};

/**
 * Kick off Cloudflare Stream's AI ("generated") captions for a ready video.
 *
 * Asynchronous on Stream's side: this returns as soon as generation is accepted
 * (the track reports `inprogress`); the `.vtt` only becomes fetchable once the
 * track flips to `ready`. Idempotent in practice — re-requesting an existing
 * generated track is a no-op rather than an error, so it is safe to call from a
 * webhook that may be redelivered. Returns `false` on a hard API failure so the
 * caller can decide whether to retry, without throwing into a webhook handler.
 */
export async function generateCaptions(
  uid: string,
  language: string = DEFAULT_CAPTION_LANGUAGE,
): Promise<boolean> {
  const res = await streamFetch(`/${uid}/captions/${language}/generate`, {
    method: "POST",
  });
  return res.ok;
}

/**
 * Fetch the status of a single generated caption track, or null if Stream has
 * no track for this language yet (e.g. generation was never requested, or the
 * list call failed). Used to poll for readiness before downloading the VTT.
 */
export async function getCaptionStatus(
  uid: string,
  language: string = DEFAULT_CAPTION_LANGUAGE,
): Promise<CaptionStatus | null> {
  const res = await streamFetch(`/${uid}/captions`);
  if (!res.ok) return null;

  const body = (await res.json()) as { result?: CaptionTrack[] };
  const track = body.result?.find((t) => t.language === language);
  return track ? track.status : null;
}

/**
 * Download the WebVTT body for a generated caption track. Returns the raw VTT
 * text, or null when the track is missing / not ready / the request failed.
 * Parsing VTT → plain transcript text is the consumer's job (see
 * `@/lib/transcript`), keeping this module free of higher-level concerns.
 */
export async function fetchCaptionVtt(
  uid: string,
  language: string = DEFAULT_CAPTION_LANGUAGE,
): Promise<string | null> {
  const res = await streamFetch(`/${uid}/captions/${language}/vtt`);
  if (!res.ok) return null;
  return res.text();
}
