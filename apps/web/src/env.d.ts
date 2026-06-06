// Typed environment for autocomplete + safety.
// VITE_* are inlined into the browser bundle by Vite (read via import.meta.env);
// server-only secrets are read from process.env on the Cloudflare Worker.

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_APP_URL: string;
  /** Cloudflare Web Analytics beacon token (optional). */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
  /** Cloudflare Stream customer code (the `customer-<CODE>` subdomain). Public. */
  readonly VITE_STREAM_CUSTOMER_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    SUPABASE_URL?: string;
    SUPABASE_SECRET_KEY?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    VITE_APP_URL?: string;
    VITE_STREAM_CUSTOMER_CODE?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_STREAM_API_TOKEN?: string;
    STREAM_WEBHOOK_SECRET?: string;
    STREAM_SIGNING_KEY_ID?: string;
    STREAM_SIGNING_JWK?: string;
    CRON_SECRET?: string;
    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;
    AI_MODERATION_ENABLED?: string;
    OPENAI_API_KEY?: string;
    POLAR_ENABLED?: string;
    POLAR_ACCESS_TOKEN?: string;
    POLAR_WEBHOOK_SECRET?: string;
    POLAR_SERVER?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    TWITTER_CLIENT_ID?: string;
    TWITTER_CLIENT_SECRET?: string;
  }
}

// Cloudflare Worker bindings, accessed via `import { env } from "cloudflare:workers"`.
// `MEDIA` is the R2 bucket for public media (see lib/storage.ts + routes/media.$.ts).
declare module "cloudflare:workers" {
  interface R2Object {
    readonly body: ReadableStream;
    readonly httpEtag: string;
    writeHttpMetadata(headers: Headers): void;
  }
  interface R2Bucket {
    put(
      key: string,
      value: ArrayBuffer | ReadableStream | string | Blob,
      options?: {
        httpMetadata?: { contentType?: string; cacheControl?: string };
      },
    ): Promise<unknown>;
    get(key: string): Promise<R2Object | null>;
    delete(key: string): Promise<void>;
  }
  export const env: { MEDIA: R2Bucket };
}
