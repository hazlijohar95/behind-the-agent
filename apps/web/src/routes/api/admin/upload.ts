import { type AccessLevel, rateLimiters, videoRepo } from "@btc/db";
import { createDirectUpload } from "@btc/stream";
import { createFileRoute } from "@tanstack/react-router";
import { authedRoute, json } from "@/lib/api";

/** Reject absurdly long inputs up front (4h ceiling). */
const MAX_DURATION_SECONDS = 4 * 60 * 60;

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
        let uploadLength = 0;
        let fileName: string | undefined;
        try {
          const data = (await request.json()) as {
            title?: string;
            access?: AccessLevel;
            uploadLength?: number;
            fileName?: string;
          };
          if (data.title?.trim()) title = data.title.trim();
          if (data.access) access = data.access;
          if (typeof data.uploadLength === "number")
            uploadLength = data.uploadLength;
          if (data.fileName) fileName = data.fileName;
        } catch {
          // allow empty body — defaults apply
        }

        if (!Number.isInteger(uploadLength) || uploadLength <= 0) {
          return json({ error: "A valid file size is required" }, 400);
        }

        // Free videos play publicly; subscriber/purchase videos require signed URLs.
        const requireSignedURLs = access !== "free";

        const upload = await createDirectUpload({
          uploadLength,
          fileName,
          requireSignedURLs,
          maxDurationSeconds: MAX_DURATION_SECONDS,
        });

        const video = await videoRepo.createVideo({
          title,
          access,
          playbackPolicy: requireSignedURLs ? "signed" : "public",
          streamUid: upload.uid,
        });

        return json({
          uploadUrl: upload.uploadUrl,
          uid: upload.uid,
          videoId: video.id,
        });
      }),
    },
  },
});
