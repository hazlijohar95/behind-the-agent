import { engagementRepo, rateLimiters } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { clientFingerprint, clientIp, json } from "@/lib/api";

export const Route = createFileRoute("/api/videos/$id/view")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const id = params.id;

        const { success } = await rateLimiters
          .view()
          .limit(`view:${clientIp(request)}`);
        if (!success) return json({ error: "Too many requests" }, 429);

        const views = await engagementRepo.incrementView(
          id,
          clientFingerprint(request),
        );
        return json({ views });
      },
    },
  },
});
