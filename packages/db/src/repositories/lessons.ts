import { getDb } from "../client";
import type { Database } from "../database.types";
import { slugify } from "../id";
import type { AccessLevel, Lesson, PublishStatus, Visibility } from "../types";

type Tables = Database["public"]["Tables"];
type LessonRow = Tables["lessons"]["Row"];
type LessonUpdate = Tables["lessons"]["Update"];

function toMs(ts: string | null): number | null {
  return ts ? new Date(ts).getTime() : null;
}

export function rowToLesson(r: LessonRow): Lesson {
  return {
    id: r.id,
    moduleId: r.module_id,
    courseId: r.course_id,
    videoId: r.video_id,
    title: r.title,
    description: r.description ?? "",
    slug: r.slug,
    position: r.position,
    publishStatus: r.publish_status as Lesson["publishStatus"],
    dripDays: r.drip_days,
    createdAt: toMs(r.created_at) ?? 0,
    updatedAt: toMs(r.updated_at) ?? 0,
  };
}

/**
 * Resolve a lesson slug unique within its course (the DB enforces a
 * `unique (course_id, slug)` constraint, so deep links stay stable). Single
 * query over the `root%` prefix scoped to the course.
 */
async function uniqueLessonSlug(
  courseId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "lesson";
  let query = getDb()
    .from("lessons")
    .select("slug, id")
    .eq("course_id", courseId)
    .like("slug", `${root}%`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;

  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const { data } = await getDb()
    .from("lessons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToLesson(data) : null;
}

export async function getLessonBySlug(
  courseId: string,
  slug: string,
): Promise<Lesson | null> {
  const { data } = await getDb()
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("slug", slug)
    .maybeSingle();
  return data ? rowToLesson(data) : null;
}

/** Lessons in a module, in display order. */
export async function listByModule(moduleId: string): Promise<Lesson[]> {
  const { data } = await getDb()
    .from("lessons")
    .select("*")
    .eq("module_id", moduleId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map(rowToLesson);
}

/** All lessons in a course (any module), ordered by module then position. */
export async function listByCourse(
  courseId: string,
  opts: { publishedOnly?: boolean } = {},
): Promise<Lesson[]> {
  let q = getDb().from("lessons").select("*").eq("course_id", courseId);
  if (opts.publishedOnly) q = q.eq("publish_status", "published");
  q = q
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const { data } = await q;
  return (data ?? []).map(rowToLesson);
}

async function nextPosition(moduleId: string): Promise<number> {
  const { data } = await getDb()
    .from("lessons")
    .select("position")
    .eq("module_id", moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? data.position + 1 : 0;
}

export async function createLesson(input: {
  moduleId: string;
  courseId: string;
  title: string;
  description?: string;
  videoId?: string | null;
}): Promise<Lesson> {
  const slug = await uniqueLessonSlug(input.courseId, input.title || "lesson");
  const position = await nextPosition(input.moduleId);
  // course_id is denormalised; the `lessons_sync_course_id` trigger derives it
  // authoritatively from the module on write. We still pass the caller's value
  // to satisfy the NOT NULL Insert type — the trigger overwrites it to match.
  const { data, error } = await getDb()
    .from("lessons")
    .insert({
      module_id: input.moduleId,
      course_id: input.courseId,
      video_id: input.videoId ?? null,
      title: input.title,
      description: input.description ?? "",
      slug,
      position,
      publish_status: "draft",
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "Failed to create lesson");
  return rowToLesson(data);
}

export type UpdateLessonInput = Partial<
  Pick<
    Lesson,
    | "title"
    | "description"
    | "videoId"
    | "position"
    | "dripDays"
    | "publishStatus"
    | "slug"
  >
>;

export async function updateLesson(
  id: string,
  patch: UpdateLessonInput,
): Promise<Lesson | null> {
  const existing = await getLesson(id);
  if (!existing) return null;

  const update: LessonUpdate = {};
  if (patch.slug && patch.slug !== existing.slug) {
    update.slug = await uniqueLessonSlug(existing.courseId, patch.slug, id);
  }
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.videoId !== undefined) update.video_id = patch.videoId;
  if (patch.position !== undefined) update.position = patch.position;
  if (patch.dripDays !== undefined) update.drip_days = patch.dripDays;
  if (patch.publishStatus !== undefined)
    update.publish_status = patch.publishStatus;

  const { data } = await getDb()
    .from("lessons")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  return data ? rowToLesson(data) : null;
}

export async function setPublishStatus(
  id: string,
  status: PublishStatus,
): Promise<Lesson | null> {
  const { data } = await getDb()
    .from("lessons")
    .update({ publish_status: status })
    .eq("id", id)
    .select("*")
    .single();
  return data ? rowToLesson(data) : null;
}

export async function deleteLesson(id: string): Promise<void> {
  await getDb().from("lessons").delete().eq("id", id);
}

/**
 * Persist a new ordering for the lessons of a module. Scoped to `module_id` so
 * a forged id can't reorder another module's lessons.
 */
export async function reorder(
  moduleId: string,
  order: { id: string; position: number }[],
): Promise<void> {
  const db = getDb();
  await Promise.all(
    order.map(({ id, position }) =>
      db
        .from("lessons")
        .update({ position })
        .eq("id", id)
        .eq("module_id", moduleId),
    ),
  );
}

/** Count of published lessons in a course (curriculum/landing stats). */
export async function countPublished(courseId: string): Promise<number> {
  const { count } = await getDb()
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("publish_status", "published");
  return count ?? 0;
}

/**
 * The first published lesson of a course (module order, then lesson position).
 * Powers the "Start course" CTA's deep link. Null when the curriculum has no
 * published lesson yet. Uses the same module→position ordering as
 * {@link listByCourse} so "first" matches what the curriculum shows.
 */
export async function getFirstPublishedLesson(
  courseId: string,
): Promise<Lesson | null> {
  const lessons = await listByCourse(courseId, { publishedOnly: true });
  return lessons[0] ?? null;
}

/**
 * Published lessons that play a given video, each paired with its parent
 * course's access level and publish/visibility state.
 *
 * This is the join the playback side-door hardening (C1) needs: a standalone
 * video page (`/v/$slug`) must treat a video as gated when it backs a lesson of
 * a *gated* course, even if the video's own `access` is `free`. Resolving that
 * requires knowing the course(s) a video is wired into. Returns one row per
 * published lesson referencing the video (usually zero or one). Runs as the
 * service role like the rest of the repo; callers decide gating from `access`.
 */
export type LessonCourseAccess = {
  lessonId: string;
  courseId: string;
  courseSlug: string;
  courseAccess: AccessLevel;
  coursePublishStatus: PublishStatus;
  courseVisibility: Visibility;
};

export async function listPublishedLessonCoursesByVideo(
  videoId: string,
): Promise<LessonCourseAccess[]> {
  // Inner-join lessons → courses; PostgREST embeds the parent course row.
  const { data } = await getDb()
    .from("lessons")
    .select(
      "id, course_id, publish_status, courses!inner(slug, access, publish_status, visibility)",
    )
    .eq("video_id", videoId)
    .eq("publish_status", "published");

  type Row = {
    id: string;
    course_id: string;
    publish_status: string;
    courses: {
      slug: string;
      access: string;
      publish_status: string;
      visibility: string;
    };
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    lessonId: r.id,
    courseId: r.course_id,
    courseSlug: r.courses.slug,
    courseAccess: r.courses.access as AccessLevel,
    coursePublishStatus: r.courses.publish_status as PublishStatus,
    courseVisibility: r.courses.visibility as Visibility,
  }));
}
