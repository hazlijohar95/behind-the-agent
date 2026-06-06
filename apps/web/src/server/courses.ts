import {
  type AccessLevel,
  accessLevels,
  courseRepo,
  lessonRepo,
  moduleRepo,
  tagRepo,
  videoRepo,
  visibilities,
} from "@btc/db";
import { setRequireSignedURLs } from "@btc/stream";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";

/* ───────────────────────── Paywall enforcement (Layer 2) ───────────────────────── */

/** A course is gated when watching its lessons requires an entitlement. */
function isGatedAccess(access: AccessLevel): boolean {
  return access !== "free";
}

/**
 * Make a lesson's backing video safe to gate behind a paid course (the real fix
 * for the paywall bypass). A free video defaults to `requireSignedURLs=false` /
 * `playbackPolicy="public"` on Cloudflare, so its bare uid plays the full video
 * with no token — leaking the uid (e.g. from a thumbnail URL) bypasses the
 * paywall entirely. Here we AUTO-FLIP the backing video to signed playback on
 * BOTH sides: Cloudflare Stream (`requireSignedURLs=true`, the enforcer) and the
 * DB (`playbackPolicy="signed"`, so the player mints a token instead of emitting
 * the bare uid).
 *
 * Cloudflare is the source of truth, so we flip Stream FIRST and only persist
 * `playbackPolicy="signed"` once that succeeds. If the Stream call fails we
 * throw — the caller turns that into a BLOCKING admin error (publish / attach is
 * rejected) so a public-policy video can never silently back a paid lesson. We
 * never persist `signed` in the DB while Stream is still public (that would make
 * the player refuse to play a video that Cloudflare still serves raw — the worst
 * of both: broken for buyers, open to scrapers).
 *
 * Idempotent and cheap: a video already on signed playback is skipped, and one
 * with no `streamUid` yet (still uploading) is left for the next attach/publish.
 */
async function ensureBackingVideoSigned(videoId: string): Promise<void> {
  const video = await videoRepo.getVideo(videoId);
  // Nothing to enforce: the video is gone, hasn't finished uploading (no uid),
  // or is already signed on both sides.
  if (!video?.streamUid || video.playbackPolicy === "signed") return;

  // Cloudflare first (the enforcer); only persist the DB policy if it succeeds.
  await setRequireSignedURLs(video.streamUid, true);
  await videoRepo.setPlaybackPolicy(video.id, "signed");
}

/* ───────────────────────── Courses ───────────────────────── */

const createCourseInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2_000).optional(),
});

export const createCourseAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createCourseInput.parse(input))
  .handler(async ({ data: input }) => {
    await requireAdmin();
    const course = await courseRepo.createCourse({
      title: input.title,
      description: input.description,
    });
    return { ok: true as const, id: course.id };
  });

const saveCourseInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(2_000),
  body: z.string().max(50_000),
  categoryId: z.string().min(1).nullable(),
  tags: z.array(z.string().min(1).max(80)).max(50),
  access: z.enum(accessLevels),
  visibility: z.enum(visibilities),
  // one-time-purchase product id; required at publish time when access=purchase
  // (validated in the handler so a draft can be saved without it).
  polarProductId: z.string().min(1).max(200).nullable(),
  priceAmount: z.number().int().nonnegative().nullable(),
  dripEnabled: z.boolean(),
  intent: z.enum(["save", "publish", "unpublish", "schedule"]),
  publishAt: z.number().int().nullable().optional(),
});

export type SaveCourseInput = z.infer<typeof saveCourseInput>;

export const saveCourseAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveCourseInput.parse(input))
  .handler(async ({ data: input }) => {
    await requireAdmin();
    if (input.tags.length) await tagRepo.ensureTags(input.tags);

    await courseRepo.updateCourse(input.id, {
      title: input.title,
      description: input.description,
      body: input.body,
      categoryId: input.categoryId,
      tags: input.tags,
      access: input.access,
      visibility: input.visibility,
      polarProductId: input.polarProductId,
      priceAmount: input.priceAmount,
      dripEnabled: input.dripEnabled,
    });

    const course = await courseRepo.getCourse(input.id);
    if (!course) return { ok: false as const, error: "Course not found" };

    if (input.intent === "publish") {
      // A purchase-gated course is unsellable without a Polar product — refuse
      // to publish rather than ship a broken buy button.
      if (course.access === "purchase" && !course.polarProductId) {
        return {
          ok: false as const,
          error: "Set a Polar product id before publishing a paid course.",
        };
      }

      // PAYWALL ENFORCEMENT (Layer 2): a gated course's lessons must be signed
      // on Cloudflare, else the bare uid plays the full video for free. Flip
      // every backing video to signed playback BEFORE publishing; if any flip
      // fails, BLOCK the publish so a public-policy video can never back a paid
      // lesson. (Free courses need no signing — public playback is intended.)
      if (isGatedAccess(course.access)) {
        const lessons = await lessonRepo.listByCourse(input.id);
        const videoIds = [
          ...new Set(
            lessons.map((l) => l.videoId).filter((v): v is string => v != null),
          ),
        ];
        try {
          for (const videoId of videoIds) {
            await ensureBackingVideoSigned(videoId);
          }
        } catch (err) {
          console.error("[course publish] could not secure backing video", err);
          return {
            ok: false as const,
            error:
              "Could not secure this course's videos for paid playback. " +
              "Please try again; if it persists, check the Cloudflare Stream " +
              "configuration before publishing.",
          };
        }
      }

      await courseRepo.publishCourse(input.id);
    } else if (input.intent === "unpublish") {
      await courseRepo.unpublishCourse(input.id);
    } else if (input.intent === "schedule" && input.publishAt) {
      await courseRepo.scheduleCourse(input.id, input.publishAt);
    }

    return { ok: true as const };
  });

export const deleteCourseAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await courseRepo.deleteCourse(data.id);
    return { ok: true as const };
  });

/* ───────────────────────── Modules ───────────────────────── */

export const createModuleAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        courseId: z.string().min(1),
        title: z.string().min(1).max(200),
        description: z.string().max(2_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    await requireAdmin();
    const module = await moduleRepo.createModule(input);
    return { ok: true as const, id: module.id };
  });

export const updateModuleAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();
    await moduleRepo.updateModule(id, patch);
    return { ok: true as const };
  });

export const deleteModuleAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await moduleRepo.deleteModule(data.id);
    return { ok: true as const };
  });

export const reorderModulesAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        courseId: z.string().min(1),
        order: z
          .array(
            z.object({
              id: z.string().min(1),
              position: z.number().int().nonnegative(),
            }),
          )
          .max(500),
      })
      .parse(input),
  )
  .handler(async ({ data: { courseId, order } }) => {
    await requireAdmin();
    await moduleRepo.reorder(courseId, order);
    return { ok: true as const };
  });

/* ───────────────────────── Lessons ───────────────────────── */

export const createLessonAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        moduleId: z.string().min(1),
        courseId: z.string().min(1),
        title: z.string().min(1).max(300),
        description: z.string().max(2_000).optional(),
        videoId: z.string().min(1).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    await requireAdmin();

    // PAYWALL ENFORCEMENT (Layer 2): attaching a video to a GATED course's
    // lesson must flip that video to signed playback, else its bare uid plays
    // the full video for free. Do this BEFORE creating the lesson so we never
    // wire a public-policy video into a paid course; a Stream failure blocks
    // the attach with a clear error.
    if (input.videoId) {
      const course = await courseRepo.getCourse(input.courseId);
      if (course && isGatedAccess(course.access)) {
        try {
          await ensureBackingVideoSigned(input.videoId);
        } catch (err) {
          console.error("[lesson create] could not secure video", err);
          return {
            ok: false as const,
            error:
              "Could not secure this video for paid playback. Please try " +
              "again before attaching it to a paid course.",
          };
        }
      }
    }

    const lesson = await lessonRepo.createLesson({
      moduleId: input.moduleId,
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      videoId: input.videoId ?? null,
    });
    return { ok: true as const, id: lesson.id };
  });

const updateLessonInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2_000).optional(),
  videoId: z.string().min(1).nullable().optional(),
  dripDays: z.number().int().nonnegative().max(3650).optional(),
  publishStatus: z.enum(["draft", "scheduled", "published"]).optional(),
});

export const updateLessonAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateLessonInput.parse(input))
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();

    // PAYWALL ENFORCEMENT (Layer 2): if this update attaches a video to a lesson
    // of a GATED course, flip that video to signed playback BEFORE persisting,
    // so a public-policy video can never come to back a paid lesson. A Stream
    // failure blocks the update. Resolve the course via the lesson (the update
    // payload carries only the lesson id).
    if (patch.videoId) {
      const lesson = await lessonRepo.getLesson(id);
      const course = lesson
        ? await courseRepo.getCourse(lesson.courseId)
        : null;
      if (course && isGatedAccess(course.access)) {
        try {
          await ensureBackingVideoSigned(patch.videoId);
        } catch (err) {
          console.error("[lesson update] could not secure video", err);
          return {
            ok: false as const,
            error:
              "Could not secure this video for paid playback. Please try " +
              "again before attaching it to a paid course.",
          };
        }
      }
    }

    await lessonRepo.updateLesson(id, patch);
    return { ok: true as const };
  });

export const deleteLessonAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await lessonRepo.deleteLesson(data.id);
    return { ok: true as const };
  });

export const reorderLessonsAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        moduleId: z.string().min(1),
        order: z
          .array(
            z.object({
              id: z.string().min(1),
              position: z.number().int().nonnegative(),
            }),
          )
          .max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data: { moduleId, order } }) => {
    await requireAdmin();
    await lessonRepo.reorder(moduleId, order);
    return { ok: true as const };
  });
