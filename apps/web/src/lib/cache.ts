import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Mark the current SSR/server-fn response as edge-cacheable on Cloudflare.
 *
 * Use ONLY on pages whose output does not vary by user (the public catalog:
 * home, category, marketing pages). `s-maxage` is honored by Cloudflare's edge
 * cache but ignored by browsers, and `stale-while-revalidate` serves a cached
 * copy instantly while refreshing in the background. Replaces the old Next.js
 * tag-based data cache with a TTL + SWR model (the standard Workers pattern).
 *
 * Do NOT call this on authenticated or per-user pages (watch/account/admin).
 */
export function cachePublic(sMaxAge = 300, staleWhileRevalidate = 86_400) {
  setResponseHeader(
    "cache-control",
    `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  );
}
