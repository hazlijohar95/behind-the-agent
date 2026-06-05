import { engagementRepo, rateLimiters } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { apiRoute, clientFingerprint, clientIp, json } from "@/lib/api";

export const Route = createFileRoute("/api/videos/$id/view")({
  server: {
    handlers: {
      POST: apiRoute<{ id: string }>(async ({ request, params }) => {
        const { success } = await rateLimiters
          .view()
          .limit(`view:${clientIp(request)}`);
        if (!success) return json({ error: "Too many requests" }, 429);

        const views = await engagementRepo.incrementView(
          params.id,
          clientFingerprint(request),
        );
        return json({ views });
      }),
    },
  },
});
