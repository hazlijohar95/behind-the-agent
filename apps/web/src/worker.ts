import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { runScheduledCron } from "@/server/cron";

// Custom Cloudflare Worker entry. Re-exports the TanStack Start SSR fetch
// handler (so the app still renders) AND adds a `scheduled` handler driven by
// the Cron Trigger in wrangler.jsonc (`*/5 * * * *`), replacing the Vercel cron
// that hit /api/cron/publish. The scheduled run reaches parity with that route
// — publish due videos + courses, broadcast new-content emails — and also
// drains any ready-but-untranscribed videos (the route only published videos).
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
    // runScheduledCron isolates each step internally and never rejects, so the
    // scheduled invocation is reported successful as long as the work was
    // attempted; per-step failures are logged for the Workers dashboard.
    ctx.waitUntil(runScheduledCron());
  },
};
