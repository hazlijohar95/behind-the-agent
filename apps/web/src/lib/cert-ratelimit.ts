/**
 * Client-IP derivation for the public certificate routes' rate limiter (M2).
 *
 * The verify page (`/cert/$serial`) and its SVG image (`/api/cert/$serial.svg`)
 * are unauthenticated, so there's no user id to key a limiter on — we key on the
 * caller's IP instead. On Cloudflare the ONLY trustworthy source of the client
 * IP is the `CF-Connecting-IP` header, which the edge sets and overwrites on
 * every request; client-supplied `X-Forwarded-For` / `X-Real-IP` are spoofable
 * and must not be trusted for an abuse limiter (a guesser could rotate them to
 * dodge the cap). We deliberately do NOT fall back to those headers.
 *
 * Falls back to a single shared bucket ("0.0.0.0") when the header is absent
 * (e.g. local dev / non-CF runtime); that only makes the limit stricter, never
 * looser, which is the safe direction for an abuse control.
 */
export function cfClientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")?.trim() || "0.0.0.0";
}
