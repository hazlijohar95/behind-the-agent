import { cacheTags, engagementRepo, rateLimiters } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { bust, json, requireApiUser } from "@/lib/api";

export const Route = createFileRoute("/api/videos/$id/like")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const id = params.id;
        const auth = await requireApiUser();
        if ("response" in auth) return auth.response;

        const { success } = await rateLimiters
          .like()
          .limit(`like:${auth.user.id}`);
        if (!success) return json({ error: "Too many requests" }, 429);

        const result = await engagementRepo.toggleLike(id, auth.user.id);

        // Like counts feed the "liked" + popularity ordering of cached feeds.
        bust(cacheTags.video(id), cacheTags.videos);

        return json(result);
      },
    },
  },
});
