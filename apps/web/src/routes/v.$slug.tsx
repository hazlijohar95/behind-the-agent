import { lessonRepo } from "@btc/db";
import { signToken } from "@btc/stream";
import { type MediaItem, streamThumbnailUrl } from "@btc/ui";
import { Prose } from "@btc/ui/components/mdx";
import { StreamPlayer } from "@btc/ui/components/stream-player";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import {
  BrowserUpdatedIcon,
  LockIcon,
  PlayArrowIcon,
  SubtitlesIcon,
} from "@/components/home/icons";
import { BrandHeader, LandingFooter } from "@/components/home/landing";
import { Paywall } from "@/components/watch/paywall";
import { ViewBeacon } from "@/components/watch/view-beacon";
import {
  getCategoryByIdCached,
  getFeed,
  getSettingsCached,
  getVideoBySlugCached,
  toMediaItem,
} from "@/lib/catalog";
import {
  resolveStandaloneVideoAccess,
  type WatchAccess,
} from "@/lib/entitlements";
import { renderMarkdown } from "@/lib/markdown";
import {
  type PlaybackMisconfigReason,
  resolvePlayback,
  streamSigningMisconfigured,
} from "@/lib/playback-guard";
import { getCurrentUser } from "@/lib/session";

const loadWatch = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: { slug } }) => {
    const video = await getVideoBySlugCached(slug);
    if (video?.publishStatus !== "published") throw notFound();

    const category = video.categoryId
      ? await getCategoryByIdCached(video.categoryId)
      : null;

    let chapters: MediaItem[] = [];
    if (video.categoryId) {
      const feed = await getFeed({
        categoryId: video.categoryId,
        sort: "recent",
        limit: 50,
      });
      // Read the series in chronological order so chapter numbers follow the
      // natural course order.
      chapters = [...feed.items].sort(
        (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
      );
    }
    if (chapters.length === 0) {
      chapters = [toMediaItem({ ...video, views: 0, likes: 0 })];
    }

    const user = await getCurrentUser();

    // C1 side-door: a lesson-backing video defaults to access:"free", so the
    // standalone watch page must not let it bypass a paid course. We load the
    // published, GATED courses this video backs and gate on the strictest of the
    // video's own access and those courses' access (resolveStandaloneVideoAccess).
    const backing = await lessonRepo.listPublishedLessonCoursesByVideo(
      video.id,
    );
    const gatedBacking = backing.filter((b) => b.courseAccess !== "free");
    const access = await resolveStandaloneVideoAccess(
      video,
      user,
      gatedBacking.map((b) => ({ id: b.courseId, access: b.courseAccess })),
    );
    // The video is effectively gated (so playback must use a signed token, never
    // the bare uid) when its own access is gated OR it backs a gated course.
    const forceGated = video.access === "free" && gatedBacking.length > 0;

    // EFFECTIVE (course-aware) free: the content itself is public — the video's
    // own access is free AND it backs no gated course. This is the ONLY safe
    // signal for emitting a bare-uid thumbnail (OG image / structured data); it
    // does NOT depend on the current viewer's entitlement. A course-gated free
    // video has `playbackPolicy === "public"` yet is NOT effectively free, which
    // is exactly the case the old `playbackPolicy === "public"` OG check leaked.
    const effectivelyFree =
      video.access === "free" && gatedBacking.length === 0;

    // Gated videos play through a short-lived signed token; one token covers
    // both playback and thumbnails. Public videos play by bare uid. signToken
    // returns null when signing isn't configured.
    //
    // Security (H2/C1): a bare streamUid plays the raw video with no entitlement
    // check, so we must NEVER hand the bare uid to the player for gated content
    // (including course-gated videos). We only mint a token here when the video
    // is set up for signed playback; `resolvePlayback` decides whether playback
    // is safe and refuses (misconfigured state) for any gated video without one.
    let token: string | undefined;
    if (
      access.allowed &&
      video.streamUid &&
      video.playbackPolicy === "signed"
    ) {
      token = (await signToken(video.streamUid)) ?? undefined;
    }

    // Fail loudly (server logs) when monetization is on but the Stream signing
    // keys are unset: every gated video will refuse to play until it's fixed.
    if (streamSigningMisconfigured()) {
      console.error(
        "[playback] STREAM_SIGNING_KEY_ID / STREAM_SIGNING_JWK are unset while " +
          "monetization is enabled — gated videos cannot be played securely and " +
          "will show a misconfiguration state.",
      );
    }

    const settings = await getSettingsCached();
    const descriptionHtml = video.description
      ? renderMarkdown(video.description)
      : "";

    return {
      video,
      category,
      chapters,
      access,
      token,
      forceGated,
      effectivelyFree,
      settings,
      descriptionHtml,
    };
  });

export const Route = createFileRoute("/v/$slug")({
  loader: ({ params }) => loadWatch({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { video, settings, effectivelyFree } = loaderData;
    const description =
      video.description.slice(0, 200) || settings.defaultDescription;
    // Real per-video OG image straight from Cloudflare Stream (Workers-native,
    // no renderer). SECURITY (Layer 1): emit the bare-uid thumbnail ONLY when
    // the content is EFFECTIVELY free (the video's own access is free AND it
    // backs no gated course) — NOT when `playbackPolicy === "public"`. A
    // course-gated free video is public-policy yet paid: gating the OG image on
    // policy would leak its uid to any scraper, who could replay it to play the
    // full video. Gated/course-gated thumbnails need a signed token and we don't
    // expose paid content to scrapers, so those omit the image entirely.
    const ogImage =
      video.streamUid && effectivelyFree
        ? streamThumbnailUrl(video.streamUid, {
            width: 1200,
            height: 630,
            fit: "crop",
          })
        : null;
    return {
      meta: [
        { title: video.title },
        { name: "description", content: description },
        { property: "og:title", content: video.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "video.other" },
        ...(ogImage
          ? [
              { property: "og:image", content: ogImage },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
              { name: "twitter:image", content: ogImage },
            ]
          : []),
        {
          name: "twitter:card",
          content: ogImage ? "summary_large_image" : "summary",
        },
        { name: "twitter:title", content: video.title },
        { name: "twitter:description", content: description },
      ],
      // Structured data for Google video rich-results.
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: video.title,
            description,
            ...(ogImage ? { thumbnailUrl: ogImage } : {}),
            ...(video.publishedAt
              ? { uploadDate: new Date(video.publishedAt).toISOString() }
              : {}),
            ...(video.duration
              ? {
                  duration: `PT${Math.floor(video.duration / 60)}M${Math.round(
                    video.duration % 60,
                  )}S`,
                }
              : {}),
          }),
        },
      ],
    };
  },
  component: VideoPage,
});

function VideoPage() {
  const {
    video,
    category,
    chapters,
    access,
    token,
    forceGated,
    settings,
    descriptionHtml,
  } = Route.useLoaderData();

  const item = toMediaItem({ ...video, views: 0, likes: 0 });

  return (
    <div className="min-h-screen bg-btc-bg font-sans text-btc-text antialiased">
      <BrandHeader />

      <main className="mx-auto w-full max-w-[1728px] px-4 pb-24 pt-8 sm:px-10">
        <WatchLayout
          player={
            <PlayerArea
              video={video}
              access={access}
              item={item}
              token={token}
              forceGated={forceGated}
            />
          }
          title={video.title}
          body={
            descriptionHtml ? (
              <Prose>
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted admin-authored markdown */}
                <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
              </Prose>
            ) : null
          }
          seriesName={category?.name ?? "More videos"}
          chapters={chapters}
          activeSlug={video.slug}
        />
      </main>

      <LandingFooter siteName={settings.siteName} />
    </div>
  );
}

function WatchLayout({
  player,
  title,
  body,
  seriesName,
  chapters,
  activeSlug,
}: {
  player: ReactNode;
  title: string;
  body: ReactNode;
  seriesName: string;
  chapters: MediaItem[];
  activeSlug: string;
}) {
  return (
    <>
      {player}

      <div className="mt-12 flex flex-col gap-12 lg:flex-row lg:gap-0">
        <article className="min-w-0 flex-1 lg:pr-12">
          <h1 className="max-w-[655px] text-[32px] font-medium leading-tight text-btc-text">
            {title}
          </h1>
          {body && <div className="mt-6">{body}</div>}
        </article>

        <aside className="w-full shrink-0 lg:w-[500px] lg:border-l lg:border-btc-border lg:pl-8">
          <SeriesSidebar
            seriesName={seriesName}
            chapters={chapters}
            activeSlug={activeSlug}
          />
        </aside>
      </div>
    </>
  );
}

function PlayerArea({
  video,
  access,
  item,
  token,
  forceGated,
}: {
  video: ReturnType<typeof Route.useLoaderData>["video"];
  access: WatchAccess;
  item: MediaItem;
  token?: string;
  forceGated?: boolean;
}) {
  if (!access.allowed) {
    // SECURITY (Layer 1): strip the bare streamUid before it reaches the client
    // for gated content. A backing video is created `access:"free"`, so its uid
    // would play the full video at Cloudflare with no token — never ship it to
    // an un-entitled viewer. The paywall falls back to customPosterUrl only.
    // No `courseId`: a standalone video's purchase buys the video itself.
    return <Paywall item={{ ...item, streamUid: null }} access={access} />;
  }

  // The viewer is allowed — but for gated content `resolvePlayback` guarantees
  // we never feed the player a bare streamUid (which would bypass the paywall).
  // `forceGated` also covers free videos that back a gated course's lesson (C1).
  const decision = resolvePlayback(video, token, forceGated);

  if (decision.kind === "processing") {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-lg bg-btc-surface text-btc-muted">
        This video is still processing.
      </div>
    );
  }

  if (decision.kind === "misconfigured") {
    return <PlayerMisconfigured reason={decision.reason} />;
  }

  return (
    <>
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <StreamPlayer
          className="size-full"
          src={decision.src}
          poster={video.customPosterUrl ?? undefined}
        />
      </div>
      <ViewBeacon videoId={video.id} />
    </>
  );
}

/**
 * Shown when an entitled viewer cannot be served gated content securely. We
 * refuse to render the player rather than leak a bare, unprotected stream uid
 * (H2). The message is intentionally about configuration, not the viewer —
 * they did nothing wrong; the operator must set the Stream signing keys (or
 * mark the video as signed playback).
 */
function PlayerMisconfigured({ reason }: { reason: PlaybackMisconfigReason }) {
  const detail =
    reason === "policy-mismatch"
      ? "this video isn't set up for signed playback"
      : "secure playback isn't configured";
  return (
    <div className="grid aspect-video w-full place-items-center rounded-lg border border-btc-border bg-btc-surface p-6 text-center">
      <div className="max-w-sm space-y-3">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-btc-bg text-btc-muted">
          <LockIcon className="size-5" />
        </span>
        <h2 className="text-lg font-medium text-btc-text">
          Playback unavailable
        </h2>
        <p className="text-[14px] text-btc-muted">
          This video can't be played right now because {detail}. Please contact
          the site owner.
        </p>
      </div>
    </div>
  );
}

function durationLabel(seconds: number): string {
  if (seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  return m ? `${h}h ${m} min` : `${h}h`;
}

function SeriesSidebar({
  seriesName,
  chapters,
  activeSlug,
}: {
  seriesName: string;
  chapters: MediaItem[];
  activeSlug: string;
}) {
  const totalSeconds = chapters.reduce((sum, c) => sum + (c.duration ?? 0), 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Series header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 border-b border-btc-border pb-4">
          <h2 className="text-[20px] font-medium leading-none text-btc-text">
            {seriesName}
          </h2>
          <div className="flex items-center gap-6 pt-1">
            <span className="flex items-center gap-2 font-mono text-[13px] text-btc-muted">
              <PlayArrowIcon className="size-4" />
              {chapters.length} {chapters.length === 1 ? "video" : "videos"}
            </span>
            <span className="flex items-center gap-2 font-mono text-[13px] text-btc-muted">
              <SubtitlesIcon className="size-4" />
              {durationLabel(totalSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div className="flex flex-col gap-4">
        <h3 className="text-[20px] font-medium leading-none text-btc-text">
          Chapters
        </h3>
        <ol className="flex flex-col gap-2">
          {chapters.map((chapter, i) => {
            const active = chapter.slug === activeSlug;
            const gated = chapter.access && chapter.access !== "free";
            if (active) {
              return (
                <li key={chapter.id}>
                  <div className="flex items-center gap-2.5 rounded-[100px] border border-btc-border bg-btc-surface px-4 py-2 text-[14px] font-medium text-btc-text">
                    <span>{i + 1}.</span>
                    <span className="truncate">{chapter.title}</span>
                  </div>
                </li>
              );
            }
            return (
              <li key={chapter.id}>
                <Link
                  to="/v/$slug"
                  params={{ slug: chapter.slug }}
                  className="flex items-center gap-2.5 rounded-[4px] px-4 py-2 text-[14px] text-btc-text transition-colors hover:bg-btc-surface"
                >
                  {gated ? (
                    <LockIcon className="size-4 shrink-0 text-btc-muted" />
                  ) : (
                    <PlayArrowIcon className="size-4 shrink-0 text-btc-muted" />
                  )}
                  <span className="truncate">{chapter.title}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Video resources */}
      <div className="flex flex-col gap-4">
        <h3 className="text-[20px] font-medium leading-none text-btc-text">
          Video resources
        </h3>
        <div className="flex flex-col gap-2">
          <ResourceRow icon={<BrowserUpdatedIcon className="size-4" />}>
            Download video
          </ResourceRow>
          <ResourceRow icon={<SubtitlesIcon className="size-4" />}>
            Repository
          </ResourceRow>
        </div>
      </div>
    </div>
  );
}

function ResourceRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2.5 rounded-[4px] px-4 py-2 text-[14px] text-btc-text">
      <span className="shrink-0 text-btc-muted">{icon}</span>
      {children}
    </span>
  );
}
