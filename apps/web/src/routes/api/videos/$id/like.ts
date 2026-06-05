import { engagementRepo, rateLimiters } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { authedRoute, json } from "@/lib/api";

export const Route = createFileRoute("/api/videos/$id/like")({
  server: {
    handlers: {
      POST: authedRoute<{ id: string }>("user", async ({ params, user }) => {
        const { success } = await rateLimiters.like().limit(`like:${user.id}`);
        if (!success) return json({ error: "Too many requests" }, 429);

        const result = await engagementRepo.toggleLike(params.id, user.id);
        return json(result);
      }),
    },
  },
});
