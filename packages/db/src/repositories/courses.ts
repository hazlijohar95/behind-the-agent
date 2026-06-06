import { getDb } from "../client";
import type { Database } from "../database.types";
import { slugify } from "../id";
import type {
  Certificate,
  Course,
  CourseProgress,
  Page,
  PublishStatus,
} from "../types";

type Tables = Database["public"]["Tables"];
type CourseRow = Tables["courses"]["Row"];
type CourseUpdate = Tables["courses"]["Update"];
type CourseProgressRow = Tables["course_progress"]["Row"];
type CertificateRow = Tables["certificates"]["Row"];

function toMs(ts: string | null): number | null {
  return ts ? new Date(ts).getTime() : null;
}

export function rowToCourse(r: CourseRow): Course {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description ?? "",
    body: r.body ?? "",
    customPosterUrl: r.custom_poster_url,
    publishStatus: r.publish_status as Course["publishStatus"],
    visibility: r.visibility as Course["visibility"],
    access: r.access as Course["access"],
    requiredPlanIds: r.required_plan_ids ?? [],
    polarProductId: r.polar_product_id,
    priceAmount: r.price_amount,
    dripEnabled: r.drip_enabled,
    categoryId: r.category_id,
    tags: r.tags ?? [],
    createdAt: toMs(r.created_at) ?? 0,
    updatedAt: toMs(r.updated_at) ?? 0,
    publishAt: toMs(r.publish_at),
    publishedAt: toMs(r.published_at),
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

function rowToCertificate(r: CertificateRow): Certificate {
  return {
    id: r.id,
    serial: r.serial,
    userId: r.user_id,
    courseId: r.course_id,
    recipientName: r.recipient_name ?? "",
    courseTitle: r.course_title ?? "",
    issuedAt: toMs(r.issued_at) ?? 0,
  };
}

/**
 * Resolve a course slug unique among courses. The shared `uniqueSlug` helper is
 * typed to the videos/categories tables only, so courses get their own
 * in-memory probe over the `root%` prefix (same single-query strategy).
 */
async function uniqueCourseSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "course";
  let query = getDb()
    .from("courses")
    .select("slug, id")
    .like("slug", `${root}%`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;

  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

export async function getCourse(id: string): Promise<Course | null> {
  const { data } = await getDb()
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToCourse(data) : null;
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const { data } = await getDb()
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data ? rowToCourse(data) : null;
}

export type CreateCourseInput = {
  title: string;
  description?: string;
};

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const db = getDb();
  const slug = await uniqueCourseSlug(input.title || "course");
  const { data, error } = await db
    .from("courses")
    .insert({
      title: input.title,
      slug,
      description: input.description ?? "",
      publish_status: "draft",
      visibility: "public",
      access: "free",
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "Failed to create course");
  return rowToCourse(data);
}

export type UpdateCourseInput = Partial<
  Pick<
    Course,
    | "title"
    | "description"
    | "body"
    | "categoryId"
    | "tags"
    | "access"
    | "requiredPlanIds"
    | "polarProductId"
    | "priceAmount"
    | "visibility"
    | "dripEnabled"
    | "customPosterUrl"
    | "slug"
  >
>;

export async function updateCourse(
  id: string,
  patch: UpdateCourseInput,
): Promise<Course | null> {
  const db = getDb();
  const existing = await getCourse(id);
  if (!existing) return null;

  let slug = existing.slug;
  if (patch.slug && patch.slug !== existing.slug) {
    slug = await uniqueCourseSlug(patch.slug, id);
  }

  const update: CourseUpdate = { slug };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.access !== undefined) update.access = patch.access;
  if (patch.requiredPlanIds !== undefined)
    update.required_plan_ids = patch.requiredPlanIds;
  if (patch.polarProductId !== undefined)
    update.polar_product_id = patch.polarProductId;
  if (patch.priceAmount !== undefined) update.price_amount = patch.priceAmount;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (patch.dripEnabled !== undefined) update.drip_enabled = patch.dripEnabled;
  if (patch.customPosterUrl !== undefined)
    update.custom_poster_url = patch.customPosterUrl;

  const { data } = await db
    .from("courses")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  return data ? rowToCourse(data) : null;
}

export async function publishCourse(id: string): Promise<Course | null> {
  const course = await getCourse(id);
  if (!course) return null;
  const publishedAt = course.publishedAt ?? Date.now();
  const { data } = await getDb()
    .from("courses")
    .update({
      publish_status: "published",
      published_at: new Date(publishedAt).toISOString(),
      publish_at: null,
    })
    .eq("id", id)
    .select("*")
    .single();
  return data ? rowToCourse(data) : null;
}

export async function unpublishCourse(id: string): Promise<Course | null> {
  const { data } = await getDb()
    .from("courses")
    .update({ publish_status: "draft", publish_at: null })
    .eq("id", id)
    .select("*")
    .single();
  return data ? rowToCourse(data) : null;
}

export async function scheduleCourse(
  id: string,
  publishAt: number,
): Promise<Course | null> {
  const { data } = await getDb()
    .from("courses")
    .update({
      publish_status: "scheduled",
      publish_at: new Date(publishAt).toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  return data ? rowToCourse(data) : null;
}

/**
 * Ids of scheduled courses whose publishAt is due (<= now), oldest first and
 * capped — mirrors `videoRepo.getDueScheduled` so the same cron can drain both.
 */
export async function getDueScheduled(
  now = Date.now(),
  limit = 100,
): Promise<string[]> {
  const { data } = await getDb()
    .from("courses")
    .select("id")
    .eq("publish_status", "scheduled")
    .lte("publish_at", new Date(now).toISOString())
    .order("publish_at", { ascending: true })
    .limit(limit);
  return (data ?? []).map((r) => r.id);
}

export async function deleteCourse(id: string): Promise<Course | null> {
  const course = await getCourse(id);
  if (!course) return null;
  // modules/lessons/progress cascade via FK ON DELETE CASCADE.
  await getDb().from("courses").delete().eq("id", id);
  return course;
}

export type ListPublishedCoursesOptions = {
  offset?: number;
  limit?: number;
  categoryId?: string;
  tag?: string;
};

/** Published, public-visibility courses for the public catalog. Newest first. */
export async function listPublished(
  opts: ListPublishedCoursesOptions = {},
): Promise<Page<Course>> {
  const { offset = 0, limit = 24, categoryId, tag } = opts;
  let query = getDb()
    .from("courses")
    .select("*", { count: "exact" })
    .eq("publish_status", "published")
    .eq("visibility", "public");

  if (categoryId) query = query.eq("category_id", categoryId);
  if (tag) query = query.contains("tags", [tag]);

  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, count } = await query;
  const total = count ?? 0;
  return {
    items: (data ?? []).map(rowToCourse),
    total,
    hasMore: offset + limit < total,
    nextOffset: offset + limit,
  };
}

export type ListAdminCoursesOptions = {
  offset?: number;
  limit?: number;
  status?: PublishStatus;
  query?: string;
};

export async function listAdminCourses(
  opts: ListAdminCoursesOptions = {},
): Promise<Page<Course>> {
  const { offset = 0, limit = 50, status, query } = opts;
  let q = getDb().from("courses").select("*", { count: "exact" });
  if (status) q = q.eq("publish_status", status);
  if (query) q = q.or(`title.ilike.%${query}%,slug.ilike.%${query}%`);
  q = q
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count } = await q;
  const total = count ?? 0;
  return {
    items: (data ?? []).map(rowToCourse),
    total,
    hasMore: offset + limit < total,
    nextOffset: offset + limit,
  };
}

/* ───────────────────────── Course purchases (entitlement) ───────────────────────── */

/**
 * Record a one-time course purchase. Idempotent on (user, course) so a webhook
 * redelivery costs one row, never a duplicate. Written only by the service role
 * (Polar webhook); reads gate playback via {@link hasPurchasedCourse}.
 */
export async function recordCoursePurchase(input: {
  userId: string;
  courseId: string;
  polarOrderId?: string | null;
  amount?: number;
  currency?: string;
}): Promise<void> {
  const { error } = await getDb()
    .from("course_purchases")
    .upsert(
      {
        user_id: input.userId,
        course_id: input.courseId,
        polar_order_id: input.polarOrderId ?? null,
        amount: input.amount ?? 0,
        currency: input.currency ?? "usd",
      },
      { onConflict: "user_id,course_id" },
    );
  if (error) throw new Error(error.message);
}

/** Whether the user holds a one-time purchase for this course. */
export async function hasPurchasedCourse(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const { data } = await getDb()
    .from("course_purchases")
    .select("course_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return data != null;
}

/** Course ids the user has purchased (for the account "my courses" rail). */
export async function listPurchasedCourseIds(
  userId: string,
): Promise<string[]> {
  const { data } = await getDb()
    .from("course_purchases")
    .select("course_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.course_id);
}

/* ───────────────────────── Progress / certificate reads ───────────────────────── */

/** A single user's rollup for one course, or null if they haven't started. */
export async function getCourseProgress(
  userId: string,
  courseId: string,
): Promise<CourseProgress | null> {
  const { data } = await getDb()
    .from("course_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return data ? rowToCourseProgress(data) : null;
}

/** The user's issued certificate for a course, if any (read-only view). */
export async function getCertificate(
  userId: string,
  courseId: string,
): Promise<Certificate | null> {
  const { data } = await getDb()
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return data ? rowToCertificate(data) : null;
}

/** Public certificate lookup by its shareable serial (verify page). */
export async function getCertificateBySerial(
  serial: string,
): Promise<Certificate | null> {
  const { data } = await getDb()
    .from("certificates")
    .select("*")
    .eq("serial", serial)
    .maybeSingle();
  return data ? rowToCertificate(data) : null;
}
