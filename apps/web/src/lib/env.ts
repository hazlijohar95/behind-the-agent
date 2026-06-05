/**
 * Centralized environment access — the single source of truth for the env
 * contract.
 *
 * PUBLIC config (Supabase URL + publishable key, app URL, analytics token) is
 * read from Vite's `import.meta.env`. Vite inlines `VITE_*` vars into BOTH the
 * browser and the SSR (Worker) bundles at build time, sourced from `.env*` files
 * locally and from the build environment in CI. There is exactly one place these
 * values live: `.env` / `.env.local` (or CI build vars) — never `.dev.vars`.
 *
 * SECRETS (SUPABASE_SECRET_KEY, CLOUDFLARE_STREAM_API_TOKEN, STREAM_*, POLAR_*,
 * RESEND_*, CRON_SECRET, OAuth) are deliberately NOT in here. Read them lazily via `process.env` at the call
 * site, and NEVER at module top-level: the Cloudflare Workers runtime only
 * populates the environment per-request, so a value read while a module is first
 * evaluated is empty. Locally those secrets come from `.dev.vars`; in production
 * from `wrangler secret put`.
 */

/**
 * Runtime (Worker / Node) env fallback. Guarded so this module stays safe to
 * import from the browser, where `process` is not defined. Primarily a safety
 * net for runtime-only vars (e.g. a `wrangler` var) — `import.meta.env` is the
 * primary source for everything below.
 */
function runtimeEnv(key: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[key] : undefined;
}

/** Supabase project URL (public). */
export function supabaseUrl(): string {
  return (
    import.meta.env.VITE_SUPABASE_URL ?? runtimeEnv("VITE_SUPABASE_URL") ?? ""
  );
}

/** Supabase publishable (anon) key (public). */
export function supabasePublishableKey(): string {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    runtimeEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    ""
  );
}

/** Public base URL of the app, with any trailing slash removed. */
export function appUrl(): string {
  const raw =
    import.meta.env.VITE_APP_URL ??
    runtimeEnv("VITE_APP_URL") ??
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
