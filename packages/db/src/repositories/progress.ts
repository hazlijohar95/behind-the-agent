import { getDb } from "../client";
import type { Database } from "../database.types";
import type { CourseProgress, LessonProgress } from "../types";

type Tables = Database["public"]["Tables"];
type LessonProgressRow = Tables["lesson_progress"]["Row"];
type CourseProgressRow = Tables["course_progress"]["Row"];

function toMs(ts: string | null): number | null {
  return ts ? new Date(ts).getTime() : null;
}

export function rowToLessonProgress(r: LessonProgressRow): LessonProgress {
  return {
    userId: r.user_id,
    lessonId: r.lesson_id,
    courseId: r.course_id,
    positionSeconds: r.position_seconds,
    durationSeconds: r.duration_seconds,
    completedAt: toMs(r.completed_at),
    createdAt: toMs(r.created_at) ?? 0,
    updatedAt: toMs(r.updated_at) ?? 0,
  };
}

function rowToCourseProgress(r: CourseProgressRow): CourseProgress {
  return {
    userId: r.user_id,
    courseId: r.course_id,
    completedLessons: r.completed_lessons,
    totalLessons: r.total_lessons,
    percent: r.percent,
    lastLessonId: r.last_lesson_id,
    completedAt: toMs(r.completed_at),
    updatedAt: toMs(r.updated_at) ?? 0,
  };
}

/** The course rollup the save RPC echoes back, for an immediate rail update. */
export type SaveProgressResult = {
  courseId: string;
  percent: number;
  completed: boolean;
};

/**
 * Persist a learner's position in a lesson and (re)compute the course rollup.
 *
 * The single write path for the progress beacon. Delegates to the
 * `save_lesson_progress` SECURITY DEFINER RPC, which:
 *   - resolves the authoritative lesson→course mapping server-side (the client
 *     never supplies course_id, so a forged lessonId can't write to an
 *     arbitrary course) and rejects unknown/unpublished lessons,
 *   - UPSERTs one row keyed (user, lesson) — re-saves cost one row, never grow,
 *   - marks the lesson complete near the end (≥95% or last 5s),
 *   - and returns the resulting course_progress (percent + completed) so the
 *     caller can update the UI without a second round-trip.
 *
 * Throws when the lesson is missing/unpublished (RPC raises P0002) so the route
 * can answer 404 rather than a misleading 200.
 */
export async function saveLessonProgress(
  userId: string,
  lessonId: string,
  position: number,
  duration: number | null,
): Promise<SaveProgressResult> {
  const { data, error } = await getDb().rpc("save_lesson_progress", {
    p_user_id: userId,
    p_lesson_id: lessonId,
    p_position: position,
    // The RPC signature is `double precision`; a missing duration is sent as 0
    // (the RPC treats `duration <= 0` as "unknown" and never marks complete).
    p_duration: duration ?? 0,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  return {
    courseId: row?.course_id ?? "",
    percent: row?.percent ?? 0,
    completed: row?.completed ?? false,
  };
}

/** A learner's saved position in one lesson, used to resume playback. */
export async function getLessonProgress(
  userId: string,
  lessonId: string,
): Promise<LessonProgress | null> {
  const { data } = await getDb()
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  return data ? rowToLessonProgress(data) : null;
}

/**
 * The earliest moment a learner touched any lesson of a course — i.e. when they
 * started it. Powers drip scheduling (unlock = start + lesson.dripDays). Returns
 * null when the learner hasn't started the course (the caller treats "now" as
 * the start so day-0 lessons open immediately). One indexed read (the
 * `lesson_progress_user_course_idx` covers user+course).
 */
export async function getCourseStartedAt(
  userId: string,
  courseId: string,
): Promise<number | null> {
  const { data } = await getDb()
    .from("lesson_progress")
    .select("created_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? toMs(data.created_at) : null;
}

/** A learner's saved positions across a whole course (keyed by lessonId). */
export async function listLessonProgressByCourse(
  userId: string,
  courseId: string,
): Promise<LessonProgress[]> {
  const { data } = await getDb()
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId);
  return (data ?? []).map(rowToLessonProgress);
}

export type ListInProgressOptions = {
  /** Cap the rail (default 8 — the account page shows a short horizontal list). */
  limit?: number;
  /** Drop fully-completed courses (percent === 100). Default true. */
  excludeCompleted?: boolean;
};

/**
 * The "Continue learning" rail source: the user's course rollups, most-recently
 * touched first. Reads the denormalized `course_progress` table (maintained by
 * the lesson_progress trigger) so this hot account-page query is O(1) per row —
 * no per-course COUNT fan-out. The caller enriches each row with the next
 * lesson + its video for the poster/slug.
 */
export async function listInProgressCourses(
  userId: string,
  opts: ListInProgressOptions = {},
): Promise<CourseProgress[]> {
  const { limit = 8, excludeCompleted = true } = opts;
  let query = getDb().from("course_progress").select("*").eq("user_id", userId);
  if (excludeCompleted) query = query.lt("percent", 100);
  query = query.order("updated_at", { ascending: false }).limit(limit);

  const { data } = await query;
  return (data ?? []).map(rowToCourseProgress);
}
