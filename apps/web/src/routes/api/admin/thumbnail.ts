import { videoRepo } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { authedRoute, json } from "@/lib/api";
import { uploadPublicFile } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const Route = createFileRoute("/api/admin/thumbnail")({
  server: {
    handlers: {
      POST: authedRoute("admin", async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        const videoId = form.get("videoId");

        if (!(file instanceof File))
          return json({ error: "No file provided" }, 400);
        if (!ALLOWED.includes(file.type))
          return json({ error: "Unsupported image type" }, 400);
        if (file.size > MAX_BYTES)
          return json({ error: "Image too large (max 8MB)" }, 400);

        const ext = file.type.split("/")[1] ?? "jpg";
        let url: string;
        try {
          url = await uploadPublicFile(
            "thumbnails",
            `${crypto.randomUUID()}.${ext}`,
            file,
            file.type,
          );
        } catch {
          return json({ error: "Upload failed" }, 500);
        }

        if (typeof videoId === "string" && videoId) {
          await videoRepo.updateVideo(videoId, { customPosterUrl: url });
        }

        return json({ url });
      }),
    },
  },
});
