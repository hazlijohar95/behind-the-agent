/**
 * One-time Cloudflare Stream setup.
 *
 * Creates (a) a signing key for gated/signed playback and (b) a webhook
 * subscription so the app learns when videos finish processing. Prints the
 * secrets to paste into `.dev.vars` (local) or `wrangler secret put` (prod).
 *
 * Prerequisites — set in your shell or `.dev.vars`:
 *   CLOUDFLARE_ACCOUNT_ID        your account id
 *   CLOUDFLARE_STREAM_API_TOKEN  an API token with "Stream:Edit"
 *
 * Usage:
 *   APP_URL=https://your-app.example bun run --cwd apps/web scripts/stream-setup.ts
 *
 * The webhook URL defaults to `${APP_URL}/api/stream/webhook`.
 */

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL;

if (!accountId || !apiToken) {
  console.error(
    "Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_API_TOKEN in the environment.",
  );
  process.exit(1);
}
if (!appUrl) {
  console.error(
    "Set APP_URL (e.g. https://your-app.example) so the webhook can be registered.",
  );
  process.exit(1);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;
const auth = { Authorization: `Bearer ${apiToken}` };

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...auth, "Content-Type": "application/json", ...init.headers },
  });
  const body = (await res.json()) as {
    success: boolean;
    result: T;
    errors?: unknown;
  };
  if (!res.ok || !body.success) {
    throw new Error(
      `${path} failed: ${res.status} ${JSON.stringify(body.errors)}`,
    );
  }
  return body.result;
}

// 1. Signing key — the private JWK is returned ONCE; capture it now.
const key = await api<{ id: string; jwk: string }>("/keys", { method: "POST" });

// 2. Webhook subscription — returns the secret used to verify incoming events.
const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/stream/webhook`;
const webhook = await api<{ secret: string; notificationUrl: string }>(
  "/webhook",
  {
    method: "PUT",
    body: JSON.stringify({ notificationUrl: webhookUrl }),
  },
);

console.log(
  "\n✅ Cloudflare Stream configured. Add these to .dev.vars / secrets:\n",
);
console.log(`STREAM_SIGNING_KEY_ID=${key.id}`);
// Cloudflare returns `jwk` already base64-encoded — store it verbatim; the app
// does `JSON.parse(atob(...))` to load it for WebCrypto.
console.log(`STREAM_SIGNING_JWK=${key.jwk}`);
console.log(`STREAM_WEBHOOK_SECRET=${webhook.secret}`);
console.log(`\nWebhook registered at: ${webhook.notificationUrl}`);
console.log(
  "\nAlso set VITE_STREAM_CUSTOMER_CODE (your customer-<CODE> subdomain, from the Stream dashboard).\n",
);
