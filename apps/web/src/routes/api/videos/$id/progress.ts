import {
  courseRepo,
  lessonRepo,
  progressRepo,
  rateLimiters,
  saveProgressInput,
} from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { authedRoute, json } from "@/lib/api";
import { getBilling, isActive } from "@/lib/billing";
import { resolveLessonUnlock } from "@/lib/drip";
import { monetizationEnabled, resolveCourseAccess } from "@/lib/entitlements";

/**
 * Low-write learner-progress beacon.
 *
 * `$id` is the LESSON id (lessons are the unit progress is keyed to; the route
 * lives under `videos/` to sit alongside the existing `view`/`like` beacons).
 * The client (`progress-beacon.tsx`) throttles to ~1 write / 15s and flushes on
 * pause/ended/tab-hide via `navigator.sendBeacon`.
 *
 * Security:
 *   - authed ("user") so writes always bind to the verified caller — a forged
 *     body can't write another user's progress.
 *   - rate-limited and FAILS CLOSED (429) — `rateLimiters.progress` denies on a
 *     DB blip, so a malicious client can't hammer `save_lesson_progress`.
 *   - body validated with zod at the boundary (S7); a bad body is 400, never a
 *     silent 200.
 *   - COURSE ENTITLEMENT IS ENFORCED HERE (C2). Being signed in is not enough:
 *     before any write we resolve the lesson's course and run the SAME access
 *     decision the watch loader uses (`resolveCourseAccess` over billing +
 *     course-purchase facts) plus the drip gate. A non-entitled or drip-locked
 *     caller is rejected (403) BEFORE `saveLessonProgress`, so a free account
 *     can't accrue progress toward — and ultimately mint a certificate for — a
 *     paid course it never bought. Entitlement logic stays a single source of
 *     truth in TS (entitlements.ts/billing.ts/drip.ts/courseRepo); we don't
 *     duplicate it in SQL.
 *   - the lesson→course mapping and completion are ALSO resolved IN-DB by the
 *     SECURITY DEFINER RPC (completion from the backing video's true duration,
 *     not the client body), so the write path is safe even if a caller reaches
 *     it directly.
 */
export const Route = createFileRoute("/api/videos/$id/progress")({
  server: {
    handlers: {
      POST: authedRoute<{ id: string }>(
        "user",
        async ({ request, params, user }) => {
          const { success } = await rateLimiters
            .progress()
            .limit(`progress:${user.id}`);
          if (!success) return json({ error: "Too many requests" }, 429);

          let body: { position: number; duration?: number | null };
          try {
            body = saveProgressInput.parse(await request.json());
          } catch {
            return json({ error: "Invalid request" }, 400);
          }

          // Resolve lesson → course. An unknown/unpublished lesson, a lesson
          // whose course is missing/unpublished, is a 404 (don't leak which).
          const lesson = await lessonRepo.getLesson(params.id);
          if (lesson?.publishStatus !== "published") {
            return json({ error: "Lesson not found" }, 404);
          }
          const course = await courseRepo.getCourse(lesson.courseId);
          if (course?.publishStatus !== "published") {
            return json({ error: "Lesson not found" }, 404);
          }

          // C2: enforce the SAME course entitlement the watch loader requires
          // before recording any progress. Mirrors course.$slug.$lessonSlug.tsx.
          const hasSubscription =
            monetizationEnabled() && user
              ? isActive(await getBilling(user.id))
              : false;
          const hasPurchasedCourse =
            monetizationEnabled() && course.access === "purchase"
              ? await courseRepo.hasPurchasedCourse(user.id, course.id)
              : false;
          const access = resolveCourseAccess(course, {
            signedIn: true,
            hasSubscription,
            hasPurchasedCourse,
          });
          if (!access.allowed) {
            return json({ error: "Forbidden" }, 403);
          }

          // Drip: a drip-locked lesson must not accrue progress early, even for
          // an entitled buyer (matches the watch gate). Course start = the
          // learner's earliest lesson-progress, else "now".
          const courseStartedAt = course.dripEnabled
            ? await progressRepo.getCourseStartedAt(user.id, course.id)
            : null;
          const drip = resolveLessonUnlock({
            dripEnabled: course.dripEnabled,
            dripDays: lesson.dripDays,
            courseStartedAt,
          });
          if (!drip.unlocked) {
            return json({ error: "Forbidden" }, 403);
          }

          try {
            const result = await progressRepo.saveLessonProgress(
              user.id,
              params.id,
              body.position,
              body.duration ?? null,
            );
            return json({
              percent: result.percent,
              completed: result.completed,
            });
          } catch {
            // The RPC raises when the lesson is missing/unpublished; treat a
            // forged or stale lessonId as a 404 rather than leaking a 500.
            return json({ error: "Lesson not found" }, 404);
          }
        },
      ),
    },
  },
});
