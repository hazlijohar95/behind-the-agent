import {
  courseRepo,
  lessonRepo,
  moduleRepo,
  progressRepo,
  videoRepo,
} from "@btc/db";
import { Prose } from "@btc/ui/components/mdx";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  CourseCurriculum,
  type CurriculumModule,
} from "@/components/course/course-curriculum";
import {
  CourseEnroll,
  type EnrollReason,
} from "@/components/course/course-enroll";
import { getBilling, isActive } from "@/lib/billing";
import { getSettingsCached } from "@/lib/catalog";
import { resolveLessonUnlock } from "@/lib/drip";
import { monetizationEnabled, resolveCourseAccess } from "@/lib/entitlements";
import { renderMarkdown } from "@/lib/markdown";
import { getCurrentUser } from "@/lib/session";

function formatPrice(
  amountMinor: number | null,
  currency: string,
): string | null {
  if (amountMinor == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `$${(amountMinor / 100).toFixed(2)}`;
  }
}

const loadCourse = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: { slug } }) => {
    const course = await courseRepo.getCourseBySlug(slug);
    // getCourseBySlug runs as service role (bypasses RLS), so we enforce
    // visibility here: only a published course is viewable, and an unlisted one
    // is reachable by direct slug but never linked/listed.
    if (course?.publishStatus !== "published") throw notFound();

    const user = await getCurrentUser();

    // Entitlement facts for the pure course-access resolver. Subscription state
    // comes from the same billing source the video paywall uses; the
    // course-purchase check is a single keyed lookup.
    const hasSubscription =
      monetizationEnabled() && user
        ? isActive(await getBilling(user.id))
        : false;
    const hasPurchasedCourse =
      monetizationEnabled() && user && course.access === "purchase"
        ? await courseRepo.hasPurchasedCourse(user.id, course.id)
        : false;

    const access = resolveCourseAccess(course, {
      signedIn: user != null,
      hasSubscription,
      hasPurchasedCourse,
    });

    // Curriculum: modules + their PUBLISHED lessons, with durations pulled from
    // each lesson's backing video and completion from the viewer's progress.
    const moduleRows = await moduleRepo.listByCourse(course.id);
    const publishedLessons = await lessonRepo.listByCourse(course.id, {
      publishedOnly: true,
    });

    const videoIds = publishedLessons
      .map((l) => l.videoId)
      .filter((v): v is string => v != null);
    const videos = videoIds.length ? await videoRepo.getVideos(videoIds) : [];
    const durationByVideo = new Map(
      videos.map((v) => [v.id, v.duration ?? null]),
    );

    // Completion is per-user; resolved from the course rollup's lessons only
    // when signed in. We avoid a per-lesson query — the public page just needs
    // a checkmark, so completion is derived from lesson progress in one read.
    const completedLessonIds = new Set<string>();
    if (user) {
      const progress = await courseRepo.getCourseProgress(user.id, course.id);
      // The rollup stores counts, not the set; for the public outline we treat
      // "all complete" (100%) as every lesson done, otherwise rely on per-lesson
      // marks being absent (the dedicated lesson page reflects exact state).
      if (progress?.completedAt) {
        for (const l of publishedLessons) completedLessonIds.add(l.id);
      }
    }

    // Course start drives the per-lesson drip unlock shown in the curriculum;
    // null for an anonymous viewer or one who hasn't started (treated as "now").
    const courseStartedAt =
      user && course.dripEnabled
        ? await progressRepo.getCourseStartedAt(user.id, course.id)
        : null;

    const lessonsByModule = new Map<string, typeof publishedLessons>();
    for (const l of publishedLessons) {
      const arr = lessonsByModule.get(l.moduleId) ?? [];
      arr.push(l);
      lessonsByModule.set(l.moduleId, arr);
    }

    const modules: CurriculumModule[] = moduleRows
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        lessons: (lessonsByModule.get(m.id) ?? []).map((l) => {
          // Real per-user unlock: entitled AND past the drip date. Everyone
          // un-entitled stays locked behind the paywall CTA; entitled-but-
          // dripped lessons show the true days remaining.
          const drip = resolveLessonUnlock({
            dripEnabled: course.dripEnabled,
            dripDays: l.dripDays,
            courseStartedAt,
          });
          return {
            id: l.id,
            title: l.title,
            slug: l.slug,
            durationSeconds: l.videoId
              ? (durationByVideo.get(l.videoId) ?? null)
              : null,
            completed: completedLessonIds.has(l.id),
            unlocked: access.allowed && drip.unlocked,
            unlocksInDays: drip.unlocksInDays,
          };
        }),
      }))
      // Hide empty modules from the public outline.
      .filter((m) => m.lessons.length > 0);

    // "Start course" deep link → the first published lesson's course-aware
    // watch page (NOT /v/$slug, which ignores course entitlement). Null when
    // the curriculum has no published lesson yet.
    const firstLesson = publishedLessons[0] ?? null;

    const settings = await getSettingsCached();
    const bodyHtml = course.body ? renderMarkdown(course.body) : "";
    const priceLabel =
      course.access === "purchase"
        ? formatPrice(course.priceAmount, settings.currency)
        : null;

    const lessonTotal = publishedLessons.length;

    return {
      course,
      access,
      modules,
      bodyHtml,
      priceLabel,
      lessonTotal,
      moduleTotal: modules.length,
      firstLessonSlug: firstLesson?.slug ?? null,
      settings,
    };
  });

export const Route = createFileRoute("/_site/course/$slug")({
  loader: ({ params }) => loadCourse({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { course, settings } = loaderData;
    const description =
      course.description.slice(0, 200) || settings.defaultDescription;
    return {
      meta: [
        { title: course.title },
        { name: "description", content: description },
        { property: "og:title", content: course.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: CoursePage,
});

const ACCESS_NOTE: Record<EnrollReason, string | null> = {
  free: null,
  subscriber: "Included with your subscription.",
  purchased: "You own this course.",
  "needs-subscription": "This course is included with a subscription.",
  "needs-purchase": "Buy once, keep lifetime access.",
  "needs-signin": "Sign in to enroll in this course.",
};

function CoursePage() {
  const {
    course,
    access,
    modules,
    bodyHtml,
    priceLabel,
    lessonTotal,
    moduleTotal,
    firstLessonSlug,
  } = Route.useLoaderData();

  const reason = access.reason as EnrollReason;
  const note = ACCESS_NOTE[reason];
  // Deep link to the first lesson's course-aware watch page (course gating +
  // drip enforced there), not the standalone video page.
  const firstLessonHref = firstLessonSlug
    ? `/course/${course.slug}/${firstLessonSlug}`
    : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-10 sm:px-8">
      <div className="flex flex-col gap-10 lg:flex-row">
        <article className="min-w-0 flex-1">
          <p className="text-[13px] font-medium uppercase tracking-wide text-btc-muted">
            Course
          </p>
          <h1 className="mt-2 text-[34px] font-medium leading-tight text-btc-text">
            {course.title}
          </h1>
          {course.description && (
            <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-btc-muted">
              {course.description}
            </p>
          )}

          <div className="mt-6 flex items-center gap-6 border-y border-btc-border py-3 font-mono text-[13px] text-btc-muted">
            <span>
              {moduleTotal} {moduleTotal === 1 ? "module" : "modules"}
            </span>
            <span>
              {lessonTotal} {lessonTotal === 1 ? "lesson" : "lessons"}
            </span>
          </div>

          {bodyHtml && (
            <div className="mt-8">
              <Prose>
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by renderMarkdown (M4) */}
                <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              </Prose>
            </div>
          )}

          <div className="mt-10">
            <h2 className="mb-4 text-[22px] font-medium text-btc-text">
              What you&apos;ll learn
            </h2>
            <CourseCurriculum modules={modules} />
          </div>
        </article>

        <aside className="w-full shrink-0 lg:w-[340px]">
          <div className="sticky top-24 flex flex-col gap-4 rounded-2xl border border-btc-border bg-btc-surface p-6">
            {priceLabel && reason !== "purchased" && (
              <p className="text-[28px] font-medium text-btc-text">
                {priceLabel}
              </p>
            )}
            <CourseEnroll
              courseId={course.id}
              reason={reason}
              priceLabel={priceLabel}
              firstLessonHref={firstLessonHref}
            />
            {note && <p className="text-[13px] text-btc-muted">{note}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
