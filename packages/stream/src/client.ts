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
