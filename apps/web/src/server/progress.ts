import {
  certificateRepo,
  courseRepo,
  lessonRepo,
  progressRepo,
  videoRepo,
} from "@btc/db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  ContinueLearningItem,
  EarnedCertificate,
} from "@/components/account/types";
import { requireUser } from "@/lib/session";

/**
 * Build the enriched "Continue learning" rail for a user.
 *
 * A plain async helper (not a server fn) so it can be reused both by the
 * `loadContinueLearning` server fn and directly inside the /account route
 * loader — sharing one implementation and avoiding a second auth round-trip.
 *
 * Reads the user's in-progress course rollups (O(1) per row from the
 * denormalized `course_progress` table) and joins each to its course title and
 * resume target — the most-recently-touched lesson (`lastLessonId`, maintained
 * by the rollup trigger) and that lesson's backing video for the poster + watch
 * slug. The rail is capped (default 8) so the per-course course/lesson lookups
 * stay bounded; videos are fetched in a single batched query.
 *
 * Independent of monetization: progress works even when payments are off, so
 * callers never gate this on `monetizationEnabled()`.
 */
export async function enrichContinueLearning(
  userId: string,
): Promise<ContinueLearningItem[]> {
  const rollups = await progressRepo.listInProgressCourses(userId, {
    limit: 8,
    excludeCompleted: true,
  });
  if (rollups.length === 0) return [];

  // Resolve the resume lesson for each course (most-recently-touched).
  const lessons = await Promise.all(
    rollups.map((r) =>
      r.lastLessonId ? lessonRepo.getLesson(r.lastLessonId) : null,
    ),
  );

  // One batched video read for every resume lesson that has a backing video.
  const videoIds = lessons
    .map((l) => l?.videoId)
    .filter((v): v is string => v != null);
  const videos = videoIds.length ? await videoRepo.getVideos(videoIds) : [];
  const videoById = new Map(videos.map((v) => [v.id, v]));

  // Course titles (capped list → bounded per-course reads).
  const courses = await Promise.all(
    rollups.map((r) => courseRepo.getCourse(r.courseId)),
  );

  return rollups.map((rollup, i): ContinueLearningItem => {
    const course = courses[i];
    const lesson = lessons[i];
    const video = lesson?.videoId ? videoById.get(lesson.videoId) : undefined;
    // Resume points at the COURSE-AWARE lesson route so entitlement + drip are
    // enforced on resume (never the standalone /v/$slug page). Requires both
    // the course and the resume lesson to still resolve.
    const canResume = course != null && lesson != null;
    return {
      courseId: rollup.courseId,
      courseTitle: course?.title ?? "Course",
      percent: rollup.percent,
      courseSlug: canResume ? course.slug : null,
      lessonSlug: canResume ? lesson.slug : null,
      resumeLessonTitle: lesson?.title ?? null,
      // Poster still comes from the resume lesson's backing video, when present.
      posterStreamUid: video?.streamUid ?? null,
      posterThumbnailTime: video?.thumbnailTime ?? null,
    };
  });
}

/** All certificates a user has earned (newest first), mapped for the account UI. */
export async function loadEarnedCertificates(
  userId: string,
): Promise<EarnedCertificate[]> {
  const certs = await certificateRepo.listCertificates(userId);
  return certs.map((c) => ({
    serial: c.serial,
    courseTitle: c.courseTitle || "Course",
    issuedAt: c.issuedAt,
  }));
}

/** Server-fn wrapper around {@link enrichContinueLearning} (auth + transport). */
export const loadContinueLearning = createServerFn({ method: "GET" }).handler(
  async (): Promise<ContinueLearningItem[]> => {
    const user = await requireUser();
    return enrichContinueLearning(user.id);
  },
);

/** Server-fn wrapper around {@link loadEarnedCertificates}. */
export const loadCertificates = createServerFn({ method: "GET" }).handler(
  async (): Promise<EarnedCertificate[]> => {
    const user = await requireUser();
    return loadEarnedCertificates(user.id);
  },
);

const claimCertificateInput = z.object({ courseId: z.string().min(1) });

/**
 * Mint (or fetch) the completion certificate for a course the user finished.
 *
 * S7 pattern: the input is parsed with a real zod schema, not a compile-time
 * cast. The `issue_certificate` RPC re-checks server-side that the course is
 * 100% complete for this user (the client can't assert completion) and is
 * idempotent — a second claim returns the same serial. Returns the
 * `{ ok, serial }` shape the `useAction` hook understands.
 */
export const claimCertificateAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => claimCertificateInput.parse(input))
  .handler(async ({ data }) => {
    const user = await requireUser();
    try {
      const { serial } = await certificateRepo.issueCertificate(
        user.id,
        data.courseId,
      );
      return { ok: true as const, serial };
    } catch {
      // RPC raises P0001 when the course isn't complete yet.
      return {
        ok: false as const,
        error: "Finish the course to earn its certificate.",
      };
    }
  });
