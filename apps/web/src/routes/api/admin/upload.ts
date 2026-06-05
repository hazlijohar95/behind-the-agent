import { type AccessLevel, rateLimiters, videoRepo } from "@btc/db";
import { createDirectUpload } from "@btc/mux";
import { createFileRoute } from "@tanstack/react-router";
import { authedRoute, json } from "@/lib/api";

export const Route = createFileRoute("/api/admin/upload")({
  server: {
    handlers: {
      POST: authedRoute("admin", async ({ request, user }) => {
        const { success } = await rateLimiters
          .upload()
          .limit(`upload:${user.id}`);
        if (!success) return json({ error: "Too many uploads" }, 429);

        let title = "Untitled video";
        let access: AccessLevel = "free";
        try {
          const data = (await request.json()) as {
            title?: string;
            access?: AccessLevel;
          };
          if (data.title?.trim()) title = data.title.trim();
          if (data.access) access = data.access;
        } catch {
          // allow empty body — defaults apply
        }

        const policy = access === "free" ? "public" : "signed";
        const origin =
          import.meta.env.VITE_APP_URL ?? new URL(request.url).origin;

        const upload = await createDirectUpload({
          corsOrigin: origin,
          policy,
          generateCaptions: true,
        });

        const video = await videoRepo.createVideo({
          title,
          access,
          playbackPolicy: policy,
          muxUploadId: upload.id,
        });

        return json({
          uploadUrl: upload.url,
          uploadId: upload.id,
          videoId: video.id,
        });
      }),
    },
  },
});
