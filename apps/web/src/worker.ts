import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { runScheduledPublish } from "@/server/cron";

// Custom Cloudflare Worker entry. Re-exports the TanStack Start SSR fetch
// handler (so the app still renders) AND adds a `scheduled` handler driven by
// the Cron Trigger in wrangler.jsonc (`*/5 * * * *`), replacing the Vercel cron
// that hit /api/cron/publish.
const serverEntry = createServerEntry({
  async fetch(request) {
    return await handler.fetch(request);
  },
});

export default {
  ...serverEntry,
  async scheduled(
    _controller: { readonly cron: string; readonly scheduledTime: number },
    _env: unknown,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ) {
    ctx.waitUntil(runScheduledPublish());
  },
};
