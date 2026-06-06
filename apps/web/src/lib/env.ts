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
 * RESEND_*, CRON_SECRET, OPENAI_API_KEY, OAuth) live behind `serverEnv()` below.
 * They are read lazily, per-access, NEVER at module top-level: the Cloudflare
 * Workers runtime only populates the environment per-request, so a value read
 * while a module is first evaluated is empty. Locally those secrets come from
 * `.dev.vars`; in production from `wrangler secret put`.
 */

import { z } from "zod";

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

/* ───────────────────────────── server secrets ───────────────────────────── */

/**
 * Schema for server-only secrets.
 *
 * Every field is optional: the platform is feature-gated (Polar, OAuth, email,
 * AI moderation, signed playback all toggle independently), so a missing value
 * is not inherently an error — it just means the feature is off. Call sites that
 * genuinely require a secret should read it via {@link requireServerEnv}, which
 * throws a clear, key-named error when the value is absent. Empty strings are
 * coerced to `undefined` so a blank `.dev.vars` entry behaves like "unset".
 */
const serverEnvSchema = z.object({
  // Supabase (service-role / secret key for server-side, RLS-bypassing access).
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Cloudflare Stream (REST API auth + signed-playback keys + webhook).
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().optional(),
  STREAM_SIGNING_KEY_ID: z.string().optional(),
  STREAM_SIGNING_JWK: z.string().optional(),
  STREAM_WEBHOOK_SECRET: z.string().optional(),

  // Polar (payments / entitlements).
  POLAR_ENABLED: z.string().optional(),
  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  POLAR_SERVER: z.enum(["sandbox", "production"]).optional(),

  // Scheduled-publish cron trigger auth.
  CRON_SECRET: z.string().optional(),

  // AI moderation (OpenAI via the AI SDK).
  OPENAI_API_KEY: z.string().optional(),
  AI_MODERATION_ENABLED: z.string().optional(),

  // Transactional email (Resend) + magic-link sender.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // OAuth providers.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
});

/** Fully-typed, validated server environment. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Names of the server secrets in the contract. */
export type ServerEnvKey = keyof ServerEnv;

/**
 * Parse and validate the server secrets from the current process environment.
 *
 * Parsed lazily on every call — never cached at module scope — because the
 * Workers runtime only populates `process.env` per request. Returns a typed
 * object whose fields are all optional (see {@link serverEnvSchema}). Throws a
 * clear error if a present value fails validation (e.g. `POLAR_SERVER` set to
 * something other than `sandbox`/`production`).
 *
 * Must only ever run on the server. Importing/calling this from a browser bundle
 * is a bug — `process` is undefined there and the result would always be empty.
 */
export function serverEnv(): ServerEnv {
  const source = typeof process !== "undefined" ? process.env : {};

  // Treat empty strings as unset so blank `.dev.vars` lines don't masquerade as
  // configured secrets.
  const normalized: Record<string, string | undefined> = {};
  for (const key of Object.keys(serverEnvSchema.shape) as ServerEnvKey[]) {
    const value = source[key];
    normalized[key] = value === "" ? undefined : value;
  }

  const parsed = serverEnvSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/**
 * Typed accessor for a required server secret. Returns the value when present,
 * or throws a clear error naming the missing key. Use this at call sites that
 * cannot function without the secret (e.g. the Supabase service client, the
 * Stream API token, the Polar access token).
 */
export function requireServerEnv(key: ServerEnvKey): string {
  const value = serverEnv()[key];
  if (value == null || value === "") {
    throw new Error(
      `Missing required server environment variable: ${key}. ` +
        "Set it in .dev.vars locally or via `wrangler secret put` in production.",
    );
  }
  return value;
}
