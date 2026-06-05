import { StreamPlayer } from "@btc/ui/components/stream-player";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSettingsCached } from "@/lib/catalog";

const loadLive = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await getSettingsCached();
  const liveUid = settings.liveInputUid?.trim();
  const title = settings.liveTitle?.trim() || `${settings.siteName} — Live`;
  return { liveUid: liveUid || null, title };
});

export const Route = createFileRoute("/_site/live")({
  head: () => ({
    meta: [{ title: "Live" }],
  }),
  loader: () => loadLive(),
  component: LivePage,
});

function LivePage() {
  const { liveUid, title } = Route.useLoaderData();
  const isLive = Boolean(liveUid);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-28 pt-12 sm:px-10 sm:pt-20">
      <div className="flex flex-col items-center gap-8">
        {isLive ? (
          <div className="flex w-full flex-col gap-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <StreamPlayer
                className="size-full"
                src={liveUid as string}
                autoPlay
                muted
              />
              <span className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
                <span className="size-2 rounded-full bg-btc-error shadow-[0_0_8px_2px_rgba(236,39,41,0.7)]" />
                Live
              </span>
            </div>
            <h1 className="text-[20px] font-medium text-btc-text">{title}</h1>
          </div>
        ) : (
          <div className="grid aspect-video w-full place-items-center rounded-2xl border border-btc-border bg-btc-surface">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="flex items-center gap-2 rounded-full border border-btc-border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-btc-muted">
                <span className="size-2 rounded-full bg-btc-muted" />
                Offline
              </span>
              <p className="max-w-sm text-[15px] leading-normal text-btc-muted">
                No live stream right now. Check back soon — or follow along on
                the channel for the next broadcast.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
