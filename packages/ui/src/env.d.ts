// The app's Vite build inlines VITE_* vars into this package's source too.
// Declare the one we read here so media.ts typechecks standalone.
interface ImportMetaEnv {
  /** Cloudflare Stream customer code (the `customer-<CODE>` subdomain). Public. */
  readonly VITE_STREAM_CUSTOMER_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
