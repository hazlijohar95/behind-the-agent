import { courseRepo, profileRepo, videoRepo } from "@btc/db";
import {
  isEmailConfigured,
  newCourseEmail,
  newVideoEmail,
  sendEmail,
} from "@/lib/email";
import { appUrl } from "@/lib/env";
import { ingestTranscript } from "@/lib/transcript";

/**
 * Publishes scheduled content whose time has arrived: standalone videos and
 * courses (both have a `publish_at` + `getDueScheduled`/`publish*` pair). Pure
 * data loop — the HTTP/secret wrapper lives in the route handler, and the
 * Cron-Trigger wrapper in the Worker `scheduled()` handler.
 *
 * Lessons are intentionally NOT included: the schema has no `publish_at` on
 * lessons (only a `publish_status` that can read `scheduled`), so there is no
 * due-time to drive a cron publish — they're flipped published by the admin
 * action directly. Adding cron lesson-publishing would require a schema change.
 *
 * The return shape keeps `{ published, ids }` (videos) for the existing HTTP
 * cron route and adds `courseIds` so the Worker run can broadcast both.
 */
export async function runScheduledPublish(): Promise<{
  published: number;
  ids: string[];
  courseIds: string[];
}> {
  const [dueVideoIds, dueCourseIds] = await Promise.all([
    videoRepo.getDueScheduled(),
    courseRepo.getDueScheduled(),
  ]);

  const ids: string[] = [];
  for (const id of dueVideoIds) {
    const video = await videoRepo.publishVideo(id);
    if (video) ids.push(video.id);
  }

  const courseIds: string[] = [];
  for (const id of dueCourseIds) {
    const course = await courseRepo.publishCourse(id);
    if (course) courseIds.push(course.id);
  }

  return { published: ids.length, ids, courseIds };
}

/**
 * Email registered, non-banned members about the videos and courses that just
 * went live. Runs only when email is operator-configured (otherwise a no-op, so
 * we skip the profile fetch entirely). Unlisted content is excluded — it
 * shouldn't be broadcast. Sends are best-effort and isolated with `allSettled`:
 * one bad address must never abort the batch or fail the cron run.
 *
 * Mirrors the HTTP route's `notifyPublished` (videos) and extends it to courses;
 * the route keeps its own copy because it can't import a Worker-only entrypoint,
 * and both lean on the same shared `@/lib/email` templates.
 */
async function notifyPublished(opts: {
  videoIds: string[];
  courseIds: string[];
}): Promise<void> {
  const { videoIds, courseIds } = opts;
  if (videoIds.length === 0 && courseIds.length === 0) return;
  if (!isEmailConfigured()) return;

  const [videos, courses] = await Promise.all([
    videoIds.length
      ? videoRepo
          .getVideos(videoIds)
          .then((vs) => vs.filter((v) => v.visibility === "public"))
      : Promise.resolve([]),
    courseIds.length
      ? Promise.all(courseIds.map((id) => courseRepo.getCourse(id))).then(
          (cs) =>
            cs.filter(
              (c): c is NonNullable<typeof c> =>
                c != null && c.visibility === "public",
            ),
        )
      : Promise.resolve([]),
  ]);
  if (videos.length === 0 && courses.length === 0) return;

  const recipients = (await profileRepo.listProfiles()).filter(
    (p) => !p.banned && p.email,
  );
  if (recipients.length === 0) return;

  const base = appUrl();
  const messages = [
    ...videos.flatMap((video) => {
      const { subject, html } = newVideoEmail({
        videoTitle: video.title,
        videoUrl: `${base}/v/${video.slug}`,
      });
      return recipients.map((p) => sendEmail({ to: p.email, subject, html }));
    }),
    ...courses.flatMap((course) => {
      const { subject, html } = newCourseEmail({
        courseTitle: course.title,
        courseUrl: `${base}/course/${course.slug}`,
      });
      return recipients.map((p) => sendEmail({ to: p.email, subject, html }));
    }),
  ];

  await Promise.allSettled(messages);
}

/**
 * Drain transcripts for ready videos that still have none. Stream sends no
 * "captions ready" webhook, so the webhook only makes one inline attempt when a
 * video goes ready; this picks up the stragglers whose captions weren't ready
 * yet. {@link ingestTranscript} is idempotent and never throws — a `pending`/
 * `unavailable` result just means a later tick will retry. Capped per run so a
 * backlog can't make one cron tick unbounded.
 */
async function drainTranscripts(): Promise<void> {
  const pending = await videoRepo.getReadyWithoutTranscript();
  // Sequential: keeps Stream API pressure low and the result count bounded.
  for (const { id, streamUid } of pending) {
    await ingestTranscript(id, streamUid);
  }
}

/**
 * Full Cloudflare Cron-Trigger run (every 5 min via wrangler `crons`): publish
 * due videos + courses, broadcast the new-content emails, then drain any
 * ready-but-untranscribed videos. Each step is best-effort and isolated so one
 * failing piece can't abort the others or the scheduled invocation.
 */
export async function runScheduledCron(): Promise<void> {
  let publishedVideoIds: string[] = [];
  let publishedCourseIds: string[] = [];
  try {
    const result = await runScheduledPublish();
    publishedVideoIds = result.ids;
    publishedCourseIds = result.courseIds;
  } catch (err) {
    console.error("[cron] scheduled publish failed:", err);
  }

  try {
    await notifyPublished({
      videoIds: publishedVideoIds,
      courseIds: publishedCourseIds,
    });
  } catch (err) {
    console.error("[cron] new-content notify failed:", err);
  }

  try {
    await drainTranscripts();
  } catch (err) {
    console.error("[cron] transcript drain failed:", err);
  }
}
