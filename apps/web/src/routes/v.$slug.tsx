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
import { resolveWatchAccess, type WatchAccess } from "@/lib/entitlements";
import { renderMarkdown } from "@/lib/markdown";
import { getCurrentUser } from "@/lib/session";

const loadWatch = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data: { slug } }) => {
    const video = await getVideoBySlugCached(slug);
    if (!video || video.publishStatus !== "published") throw notFound();

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
    const access = await resolveWatchAccess(video, user);

    // Gated videos play through a short-lived signed token; one token covers
    // both playback and thumbnails. Public videos play by bare uid. signToken
    // returns null when signing isn't configured, so the player falls back to
    // the uid.
    let token: string | undefined;
    if (
      access.allowed &&
      video.streamUid &&
      video.playbackPolicy === "signed"
    ) {
      token = (await signToken(video.streamUid)) ?? undefined;
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
      settings,
      descriptionHtml,
    };
  });

export const Route = createFileRoute("/v/$slug")({
  loader: ({ params }) => loadWatch({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { video, settings } = loaderData;
    const description =
      video.description.slice(0, 200) || settings.defaultDescription;
    // Real per-video OG image straight from Cloudflare Stream (Workers-native,
    // no renderer). Only for public playback — signed/gated thumbnails need a
    // token and we don't expose paid content to scrapers, so those omit it.
    const ogImage =
      video.streamUid && video.playbackPolicy === "public"
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
}: {
  video: ReturnType<typeof Route.useLoaderData>["video"];
  access: WatchAccess;
  item: MediaItem;
  token?: string;
}) {
  if (!access.allowed) {
    return <Paywall item={item} access={access} />;
  }

  if (!video.streamUid) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-lg bg-btc-surface text-btc-muted">
        This video is still processing.
      </div>
    );
  }

  return (
    <>
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <StreamPlayer
          className="size-full"
          src={token ?? video.streamUid}
          poster={video.customPosterUrl ?? undefined}
        />
      </div>
      <ViewBeacon videoId={video.id} />
    </>
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
