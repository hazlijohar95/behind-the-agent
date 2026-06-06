import { profileRepo, videoRepo } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api";
import { isEmailConfigured, newVideoEmail, sendEmail } from "@/lib/email";
import { appUrl, serverEnv } from "@/lib/env";
import { runScheduledPublish } from "@/server/cron";

/**
 * Email registered, non-banned members about the videos that just went live.
 *
 * Runs only when email is operator-configured (otherwise it's a no-op so we skip
 * the profile fetch entirely). Unlisted videos are excluded — they shouldn't be
 * broadcast. Sends are best-effort and isolated with `allSettled`: one bad
 * address must never abort the batch or change the cron's HTTP result.
 */
async function notifyPublished(ids: string[]): Promise<void> {
  if (ids.length === 0 || !isEmailConfigured()) return;

  const videos = (await videoRepo.getVideos(ids)).filter(
    (v) => v.visibility === "public",
  );
  if (videos.length === 0) return;

  const recipients = (await profileRepo.listProfiles()).filter(
    (p) => !p.banned && p.email,
  );
  if (recipients.length === 0) return;

  const base = appUrl();
  const messages = videos.flatMap((video) => {
    const { subject, html } = newVideoEmail({
      videoTitle: video.title,
      videoUrl: `${base}/v/${video.slug}`,
    });
    return recipients.map((p) => sendEmail({ to: p.email, subject, html }));
  });

  await Promise.allSettled(messages);
}

/**
 * Publishes scheduled videos whose time has arrived, then emails subscribers
 * about each newly published video.
 *
 * Triggered by a Cloudflare Cron Trigger and protected by CRON_SECRET. This
 * endpoint mutates state (it publishes videos), so it FAILS CLOSED: if
 * CRON_SECRET is not configured we refuse to run at all (503) rather than
 * leaving a public, unauthenticated mutating endpoint exposed.
 */
export const Route = createFileRoute("/api/cron/publish")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = serverEnv().CRON_SECRET;
        // Fail closed: with no secret configured there is no way to authenticate
        // the caller, so refuse rather than run unprotected.
        if (!secret) {
          return json({ error: "Cron not configured" }, 503);
        }

        const auth = request.headers.get("authorization");
        const url = new URL(request.url);
        const provided =
          auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
        if (provided !== secret) {
          return json({ error: "Unauthorized" }, 401);
        }

        const result = await runScheduledPublish();
        await notifyPublished(result.ids);
        return json(result);
      },
    },
  },
});
