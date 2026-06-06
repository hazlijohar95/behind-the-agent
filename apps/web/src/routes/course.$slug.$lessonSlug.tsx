import {
  courseRepo,
  lessonRepo,
  moduleRepo,
  progressRepo,
  videoRepo,
} from "@btc/db";
import { signToken } from "@btc/stream";
import { Prose } from "@btc/ui/components/mdx";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ClaimCertificate } from "@/components/course/claim-certificate";
import { LessonPlayer } from "@/components/course/lesson-player";
import { BrandHeader, LandingFooter } from "@/components/home/landing";
import { SanitizedHtml } from "@/components/sanitized-html";
import { Paywall } from "@/components/watch/paywall";
import { getBilling, isActive } from "@/lib/billing";
import { getSettingsCached } from "@/lib/catalog";
import { resolveLessonUnlock } from "@/lib/drip";
import { monetizationEnabled, resolveCourseAccess } from "@/lib/entitlements";
import { renderMarkdown } from "@/lib/markdown";
import {
  type PlaybackMisconfigReason,
  resolvePlayback,
  streamSigningMisconfigured,
} from "@/lib/playback-guard";
import { getCurrentUser } from "@/lib/session";

/** One lesson in the sidebar nav (no playback — just a link + state). */
type NavLesson = {
  id: string;
  title: string;
  slug: string;
  completed: boolean;
  unlocked: boolean;
  unlocksInDays: number;
};

type NavModule = { id: string; title: string; lessons: NavLesson[] };

const loadLesson = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; lessonSlug: string }) => input)
  .handler(async ({ data: { slug, lessonSlug } }) => {
    const course = await courseRepo.getCourseBySlug(slug);
    // Service-role read bypasses RLS, so enforce visibility here: only a
    // published course is viewable (unlisted reachable by direct slug).
    if (course?.publishStatus !== "published") throw notFound();

    const lesson = await lessonRepo.getLessonBySlug(course.id, lessonSlug);
    if (lesson?.publishStatus !== "published") throw notFound();

    const user = await getCurrentUser();

    // Course-level entitlement — the SAME decision the landing page makes. This
    // is what closes the C1 bypass: playback is gated on the COURSE, never on
    // the backing video's own (default-free) access.
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

    // Drip: even an entitled buyer can't open a lesson before its unlock day.
    // Course start = the learner's earliest lesson-progress, else "now".
    const courseStartedAt =
      user && course.dripEnabled
        ? await progressRepo.getCourseStartedAt(user.id, course.id)
        : null;
    const drip = resolveLessonUnlock({
      dripEnabled: course.dripEnabled,
      dripDays: lesson.dripDays,
      courseStartedAt,
    });

    const video = lesson.videoId
      ? await videoRepo.getVideo(lesson.videoId)
      : null;

    // Resume position for an entitled learner (best-effort).
    const lessonProgress =
      access.allowed && user
        ? await progressRepo.getLessonProgress(user.id, lesson.id)
        : null;

    // SECURITY: mint a signed token ONLY when the viewer is entitled AND the
    // lesson is unlocked AND the video is set up for signed playback. A locked
    // or unentitled request never reaches signToken, so no token can leak.
    let token: string | undefined;
    if (
      access.allowed &&
      drip.unlocked &&
      video?.streamUid &&
      video.playbackPolicy === "signed"
    ) {
      token = (await signToken(video.streamUid)) ?? undefined;
    }

    if (streamSigningMisconfigured()) {
      console.error(
        "[playback] STREAM_SIGNING_KEY_ID / STREAM_SIGNING_JWK are unset while " +
          "monetization is enabled — gated lessons cannot be played securely.",
      );
    }

    // Curriculum nav: modules + published lessons with per-lesson unlock/done.
    const moduleRows = await moduleRepo.listByCourse(course.id);
    const published = await lessonRepo.listByCourse(course.id, {
      publishedOnly: true,
    });

    const completedLessonIds = new Set<string>();
    let courseCompleted = false;
    if (user) {
      const progress = await courseRepo.getCourseProgress(user.id, course.id);
      courseCompleted = progress?.completedAt != null;
      if (courseCompleted) {
        for (const l of published) completedLessonIds.add(l.id);
      }
    }

    const lessonsByModule = new Map<string, typeof published>();
    for (const l of published) {
      const arr = lessonsByModule.get(l.moduleId) ?? [];
      arr.push(l);
      lessonsByModule.set(l.moduleId, arr);
    }

    const modules: NavModule[] = moduleRows
      .map((m) => ({
        id: m.id,
        title: m.title,
        lessons: (lessonsByModule.get(m.id) ?? []).map((l): NavLesson => {
          const u = resolveLessonUnlock({
            dripEnabled: course.dripEnabled,
            dripDays: l.dripDays,
            courseStartedAt,
          });
          return {
            id: l.id,
            title: l.title,
            slug: l.slug,
            completed: completedLessonIds.has(l.id),
            unlocked: access.allowed && u.unlocked,
            unlocksInDays: u.unlocksInDays,
          };
        }),
      }))
      .filter((m) => m.lessons.length > 0);

    // Already-issued certificate (so we show a link instead of the claim CTA).
    const certificate =
      user && courseCompleted
        ? await courseRepo.getCertificate(user.id, course.id)
        : null;

    const settings = await getSettingsCached();
    const descriptionHtml = lesson.description
      ? renderMarkdown(lesson.description)
      : "";

    return {
      courseSlug: course.slug,
      courseTitle: course.title,
      courseId: course.id,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
      },
      video: video
        ? {
            id: video.id,
            streamUid: video.streamUid,
            playbackPolicy: video.playbackPolicy,
            access: video.access,
            customPosterUrl: video.customPosterUrl,
          }
        : null,
      access,
      token,
      // Course-gated lessons are always force-gated for playback so a bare uid
      // (free backing video) can never reach the player here.
      forceGated: access.gated,
      drip,
      resumeSeconds: lessonProgress?.positionSeconds ?? 0,
      modules,
      courseCompleted,
      certificateSerial: certificate?.serial ?? null,
      descriptionHtml,
      settings,
    };
  });

export const Route = createFileRoute("/course/$slug/$lessonSlug")({
  loader: ({ params }) =>
    loadLesson({ data: { slug: params.slug, lessonSlug: params.lessonSlug } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { lesson, courseTitle } = loaderData;
    return {
      meta: [
        { title: `${lesson.title} · ${courseTitle}` },
        // Lessons are paid content; keep them out of search results.
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: LessonPage,
});

function LessonPage() {
  const data = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-btc-bg font-sans text-btc-text antialiased">
      <BrandHeader />

      <main className="mx-auto w-full max-w-[1728px] px-4 pb-24 pt-8 sm:px-10">
        <p className="text-[13px] text-btc-muted">
          <Link
            to="/course/$slug"
            params={{ slug: data.courseSlug }}
            className="hover:text-btc-text"
          >
            {data.courseTitle}
          </Link>
        </p>

        <div className="mt-4 flex flex-col gap-12 lg:flex-row lg:gap-0">
          <article className="min-w-0 flex-1 lg:pr-12">
            <LessonArea data={data} />
            <h1 className="mt-6 max-w-[655px] text-[28px] font-medium leading-tight text-btc-text">
              {data.lesson.title}
            </h1>

            {data.courseCompleted && (
              <div className="mt-6 rounded-xl border border-btc-border bg-btc-surface p-5">
                <p className="text-[15px] font-medium text-btc-text">
                  You completed this course.
                </p>
                <div className="mt-3">
                  {data.certificateSerial ? (
                    <Link
                      to="/cert/$serial"
                      params={{ serial: data.certificateSerial }}
                      className="text-[14px] font-medium text-primary hover:underline"
                    >
                      View your certificate
                    </Link>
                  ) : (
                    <ClaimCertificate courseId={data.courseId} />
                  )}
                </div>
              </div>
            )}

            {data.descriptionHtml ? (
              <div className="mt-6">
                <Prose>
                  <SanitizedHtml html={data.descriptionHtml} />
                </Prose>
              </div>
            ) : null}
          </article>

          <aside className="w-full shrink-0 lg:w-[420px] lg:border-l lg:border-btc-border lg:pl-8">
            <CourseNav
              courseSlug={data.courseSlug}
              courseTitle={data.courseTitle}
              modules={data.modules}
              activeSlug={data.lesson.slug}
            />
          </aside>
        </div>
      </main>

      <LandingFooter siteName={data.settings.siteName} />
    </div>
  );
}

type LoaderData = ReturnType<typeof Route.useLoaderData>;

function LessonArea({ data }: { data: LoaderData }) {
  const { access, drip, video, token, forceGated, lesson, resumeSeconds } =
    data;

  // Not entitled → paywall. No token was minted in the loader for this case.
  // SECURITY (Layer 1): never ship the backing video's bare streamUid to an
  // un-entitled viewer — a course lesson's video is created `access:"free"` so
  // the bare uid would play the full video at Cloudflare with no token. We pass
  // streamUid:null and rely on customPosterUrl only, so no uid leaks into the
  // page source. `courseId` routes a `needs-purchase` to the COURSE checkout.
  if (!access.allowed) {
    return (
      <Paywall
        item={{
          id: video?.id ?? lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          streamUid: null,
          thumbnailTime: null,
          customPosterUrl: video?.customPosterUrl ?? null,
          duration: null,
          views: 0,
          likes: 0,
          access: "subscribers",
          categoryName: null,
          createdAt: 0,
        }}
        access={access}
        courseId={data.courseId}
      />
    );
  }

  // Entitled but drip-locked → locked state, no player, no token.
  if (!drip.unlocked) {
    return <LessonLocked unlocksInDays={drip.unlocksInDays} />;
  }

  if (!video?.streamUid) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-lg bg-btc-surface text-btc-muted">
        This lesson is still being prepared.
      </div>
    );
  }

  const decision = resolvePlayback(video, token, forceGated);

  if (decision.kind === "processing") {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-lg bg-btc-surface text-btc-muted">
        This lesson is still processing.
      </div>
    );
  }

  if (decision.kind === "misconfigured") {
    return <LessonMisconfigured reason={decision.reason} />;
  }

  return (
    <LessonPlayer
      src={decision.src}
      poster={video.customPosterUrl ?? undefined}
      lessonId={lesson.id}
      startTime={resumeSeconds > 2 ? resumeSeconds : undefined}
      enabled={access.allowed && drip.unlocked}
    />
  );
}

function LessonLocked({ unlocksInDays }: { unlocksInDays: number }) {
  return (
    <div className="grid aspect-video w-full place-items-center rounded-lg border border-btc-border bg-btc-surface p-6 text-center">
      <div className="max-w-sm space-y-3">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-btc-bg text-btc-muted">
          <Lock className="size-5" />
        </span>
        <h2 className="text-lg font-medium text-btc-text">Not yet available</h2>
        <p className="text-[14px] text-btc-muted">
          This lesson unlocks in {unlocksInDays}{" "}
          {unlocksInDays === 1 ? "day" : "days"}. Come back then to continue.
        </p>
      </div>
    </div>
  );
}

function LessonMisconfigured({ reason }: { reason: PlaybackMisconfigReason }) {
  const detail =
    reason === "policy-mismatch"
      ? "this lesson isn't set up for signed playback"
      : "secure playback isn't configured";
  return (
    <div className="grid aspect-video w-full place-items-center rounded-lg border border-btc-border bg-btc-surface p-6 text-center">
      <div className="max-w-sm space-y-3">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-btc-bg text-btc-muted">
          <Lock className="size-5" />
        </span>
        <h2 className="text-lg font-medium text-btc-text">
          Playback unavailable
        </h2>
        <p className="text-[14px] text-btc-muted">
          This lesson can't be played right now because {detail}. Please contact
          the site owner.
        </p>
      </div>
    </div>
  );
}

function CourseNav({
  courseSlug,
  courseTitle,
  modules,
  activeSlug,
}: {
  courseSlug: string;
  courseTitle: string;
  modules: NavModule[];
  activeSlug: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="border-b border-btc-border pb-4">
        <h2 className="text-[20px] font-medium leading-none text-btc-text">
          {courseTitle}
        </h2>
      </div>

      {modules.map((m, mi) => (
        <div key={m.id} className="flex flex-col gap-3">
          <h3 className="text-[15px] font-medium text-btc-text">
            {mi + 1}. {m.title}
          </h3>
          <ol className="flex flex-col gap-1">
            {m.lessons.map((lesson) => (
              <li key={lesson.id}>
                <NavRow
                  courseSlug={courseSlug}
                  lesson={lesson}
                  active={lesson.slug === activeSlug}
                />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function NavRow({
  courseSlug,
  lesson,
  active,
}: {
  courseSlug: string;
  lesson: NavLesson;
  active: boolean;
}) {
  const icon = lesson.completed ? (
    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
  ) : lesson.unlocked ? (
    <PlayCircle className="size-4 shrink-0 text-btc-muted" />
  ) : (
    <Lock className="size-4 shrink-0 text-btc-muted" />
  );

  const label: ReactNode = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
      {!lesson.unlocked && lesson.unlocksInDays > 0 && (
        <span className="shrink-0 font-mono text-[12px] text-btc-muted">
          {lesson.unlocksInDays}d
        </span>
      )}
    </>
  );

  // Locked lessons (drip) are not navigable; the active lesson isn't a link.
  if (active) {
    return (
      <div className="flex items-center gap-2.5 rounded-[4px] bg-btc-surface px-3 py-2 text-[14px] font-medium text-btc-text">
        {label}
      </div>
    );
  }
  if (!lesson.unlocked) {
    return (
      <div className="flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-[14px] text-btc-muted">
        {label}
      </div>
    );
  }
  return (
    <Link
      to="/course/$slug/$lessonSlug"
      params={{ slug: courseSlug, lessonSlug: lesson.slug }}
      className="flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-[14px] text-btc-text transition-colors hover:bg-btc-surface"
    >
      {label}
    </Link>
  );
}
