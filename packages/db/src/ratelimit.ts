import { getDb } from "./client";

export type LimitResult = { success: boolean };

/** Fixed-window limiter backed by the Postgres `check_rate_limit` RPC. */
export class Ratelimiter {
  constructor(
    private readonly prefix: string,
    private readonly max: number,
    private readonly windowSeconds: number,
  ) {}

  /**
   * Returns `{ success: false }` when the caller is over its quota.
   *
   * FAIL CLOSED: if the backing RPC errors or throws (DB down, misconfigured),
   * we treat the request as rate-limited rather than letting it through. These
   * limiters guard mutating, abuse-prone endpoints (likes, comments, views,
   * uploads); failing open would turn a transient DB blip into an open door for
   * spam/abuse, so we deny instead. The cost of a false negative (a legitimate
   * request rejected with 429 during an outage) is far lower than the cost of
   * unbounded writes.
   */
  async limit(key: string): Promise<LimitResult> {
    try {
      const { data, error } = await getDb().rpc("check_rate_limit", {
        p_key: `${this.prefix}:${key}`,
        p_max: this.max,
        p_window_seconds: this.windowSeconds,
      });
      if (error) return { success: false }; // fail closed
      return { success: data !== false };
    } catch {
      return { success: false }; // fail closed
    }
  }
}

const cache = new Map<string, Ratelimiter>();

export function getRatelimit(
  prefix: string,
  max: number,
  windowSeconds: number,
): Ratelimiter {
  const key = `${prefix}:${max}:${windowSeconds}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const limiter = new Ratelimiter(prefix, max, windowSeconds);
  cache.set(key, limiter);
  return limiter;
}

/**
 * Limiters keyed to specific mutating endpoints. Each is invoked at its route
 * handler (see apps/web/src/routes/api/...).
 *
 * NOTE: there is intentionally no `login`/`signup` limiter here. Auth is
 * handled directly by Supabase Auth from the client, so those requests never
 * pass through a route handler we control — there is no server-side auth proxy
 * to attach a limiter to. Add one back here ONLY once auth flows are proxied
 * through our own server functions; until then a limiter would be dead code
 * that gives a false sense of protection. (Brute-force protection for auth is
 * configured in Supabase itself.)
 */
export const rateLimiters = {
  like: () => getRatelimit("like", 30, 60),
  comment: () => getRatelimit("comment", 8, 60),
  view: () => getRatelimit("view", 60, 60),
  upload: () => getRatelimit("upload", 30, 60),
  // Learner-progress beacons. The client throttles to ~1 save / 15s and flushes
  // on pause/ended/tab-hide, so a generous 40/60s budget never trips a real
  // viewer (even with a flush burst) while still capping a forged client that
  // hammers `save_lesson_progress`. Like every limiter here it FAILS CLOSED
  // (see `Ratelimiter.limit`): on a DB blip the progress endpoint returns 429
  // rather than letting unbounded writes through — losing a position save is
  // harmless, an open write-amp door is not.
  progress: () => getRatelimit("progress", 40, 60),
  // Public certificate verify page + SVG image, keyed by client IP. Serials are
  // 80-bit random tokens, but a public unauthenticated lookup is still an online
  // oracle, so we cap per-IP guess volume to defeat brute-force enumeration. A
  // real viewer opening their own certificate (page + image = 2 lookups) and
  // refreshing stays well under 30/60s; a scripted guesser is throttled. FAILS
  // CLOSED like the rest: a DB blip yields 429 rather than an open oracle.
  cert: () => getRatelimit("cert", 30, 60),
};
