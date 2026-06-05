export type AuthMethods = {
  emailPassword: boolean;
  google: boolean;
  x: boolean;
  magicLink: boolean;
};

/**
 * Which sign-in methods are enabled, derived from the environment. Resolved
 * lazily — reading `process.env` at module top-level returns empty values on the
 * Workers runtime (env is only populated per-request), which would report every
 * OAuth / magic-link provider as disabled in production. Always call this.
 */
export function getAuthMethods(): AuthMethods {
  return {
    emailPassword: true,
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    x: Boolean(
      process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET,
    ),
    magicLink: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  };
}
