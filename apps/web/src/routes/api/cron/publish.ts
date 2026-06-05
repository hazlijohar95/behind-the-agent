import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api";
import { runScheduledPublish } from "@/server/cron";

/**
 * Publishes scheduled videos whose time has arrived.
 * Triggered by a Cloudflare Cron Trigger. Protected by CRON_SECRET.
 */
export const Route = createFileRoute("/api/cron/publish")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret) {
          const auth = request.headers.get("authorization");
          const url = new URL(request.url);
          const provided =
            auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
          if (provided !== secret) return json({ error: "Unauthorized" }, 401);
        }

        const result = await runScheduledPublish();
        return json(result);
      },
    },
  },
});
