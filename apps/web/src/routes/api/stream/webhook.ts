import { videoRepo, webhookRepo } from "@btc/db";
import { verifyWebhook } from "@btc/stream";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { ingestTranscript, requestTranscript } from "@/lib/transcript";

/**
 * Cloudflare Stream webhook. Fires as a video moves through encoding; we act
 * only when it becomes ready, recording duration + aspect ratio and kicking off
 * AI-generated captions (whose text we later fold back in as the transcript).
 * The stream_uid and playback policy were already persisted at upload-create
 * time, so there's nothing to "discover" here — we find the row by its uid and
 * flip it ready.
 */

/**
 * Shape of the Stream webhook body we rely on. Stream sends a richer object;
 * we validate only the fields we read and pass everything else through. Parsed
 * AFTER signature verification, so this guards against a malformed-but-signed
 * payload rather than against forgery (that's `verifyWebhook`'s job).
 */
const streamWebhookSchema = z.object({
  uid: z.string().min(1),
  // Advances on every state transition; pairs with `uid` for idempotency.
  modified: z.string().optional(),
  readyToStream: z.boolean().optional(),
  status: z.object({ state: z.string().optional() }).partial().optional(),
  duration: z.number().optional(),
  input: z
    .object({ width: z.number().optional(), height: z.number().optional() })
    .partial()
    .optional(),
});

export const Route = createFileRoute("/api/stream/webhook")({
  server: {
    handlers: {
      POST: async ({ request: req }) => {
        const body = await req.text();

        const ok = await verifyWebhook(
          body,
          req.headers.get("Webhook-Signature"),
          serverEnv().STREAM_WEBHOOK_SECRET ?? "",
        );
        if (!ok) return json({ error: "Invalid signature" }, 400);

        let parsed: z.infer<typeof streamWebhookSchema>;
        try {
          parsed = streamWebhookSchema.parse(JSON.parse(body));
        } catch {
          // Signed but unexpected/unparseable: ack so Stream stops retrying a
          // payload we'll never be able to act on.
          return json({ ok: true, ignored: true });
        }

        const { uid } = parsed;

        // Idempotency: a (uid, modified) pair is processed at most once. Stream
        // sends a webhook per state transition; `modified` advances each time.
        const fresh = await webhookRepo.markProcessed(
          "stream",
          `${uid}:${parsed.modified ?? ""}`,
        );
        if (!fresh) return json({ ok: true, deduped: true });

        try {
          const ready =
            parsed.readyToStream === true || parsed.status?.state === "ready";
          if (ready) {
            const video = await videoRepo.findVideoByStreamUid(uid);
            if (video) {
              const w = parsed.input?.width;
              const h = parsed.input?.height;
              await videoRepo.markVideoReady(video.id, {
                duration:
                  typeof parsed.duration === "number"
                    ? Math.round(parsed.duration)
                    : null,
                aspectRatio: w && h ? `${w}:${h}` : null,
              });

              // Kick off AI captions, then make a single best-effort attempt to
              // ingest them. Generation is async and usually not ready this
              // instant; a `pending`/`unavailable` result is expected and the
              // ingest is idempotent, so a later retry (cron drain) completes
              // it. Captions never block the ack — failures are swallowed.
              await requestTranscript(uid);
              await ingestTranscript(video.id, uid);
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
