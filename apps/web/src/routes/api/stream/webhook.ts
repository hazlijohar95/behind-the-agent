import { videoRepo, webhookRepo } from "@btc/db";
import { verifyWebhook } from "@btc/stream";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Cloudflare Stream webhook. Fires as a video moves through encoding; we act
 * only when it becomes ready, recording duration + aspect ratio. The stream_uid
 * and playback policy were already persisted at upload-create time, so there's
 * nothing to "discover" here — we just find the row by its uid and flip it ready.
 */
export const Route = createFileRoute("/api/stream/webhook")({
  server: {
    handlers: {
      POST: async ({ request: req }) => {
        const body = await req.text();

        const ok = await verifyWebhook(
          body,
          req.headers.get("Webhook-Signature"),
          process.env.STREAM_WEBHOOK_SECRET ?? "",
        );
        if (!ok) return json({ error: "Invalid signature" }, 400);

        let event: any;
        try {
          event = JSON.parse(body);
        } catch {
          return json({ error: "Invalid payload" }, 400);
        }

        const uid: string | undefined = event?.uid;
        if (!uid) return json({ ok: true });

        // Idempotency: a (uid, modified) pair is processed at most once. Stream
        // sends a webhook per state transition; `modified` advances each time.
        const fresh = await webhookRepo.markProcessed(
          "stream",
          `${uid}:${event?.modified ?? ""}`,
        );
        if (!fresh) return json({ ok: true, deduped: true });

        try {
          const ready =
            event?.readyToStream === true || event?.status?.state === "ready";
          if (ready) {
            const video = await videoRepo.findVideoByStreamUid(uid);
            if (video) {
              const w = event?.input?.width;
              const h = event?.input?.height;
              await videoRepo.markVideoReady(video.id, {
                duration:
                  typeof event.duration === "number"
                    ? Math.round(event.duration)
                    : null,
                aspectRatio: w && h ? `${w}:${h}` : null,
              });
            }
          }
        } catch (err) {
          console.error("[stream webhook] handler error:", err);
          return json({ error: "Handler error" }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});
