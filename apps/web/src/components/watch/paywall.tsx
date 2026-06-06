import { type MediaItem, posterFor } from "@btc/ui";
import { Lock } from "lucide-react";
import type { WatchAccess } from "@/lib/entitlements";
import { PaywallActions } from "./paywall-actions";

export function Paywall({
  item,
  access,
  courseId,
}: {
  item: MediaItem;
  access: WatchAccess;
  /**
   * Set when the paywall guards a COURSE lesson: a `needs-purchase` here means
   * "buy the course", so checkout must target the course (not the backing
   * video, which is created `access:"free"` and has no product of its own).
   * Omitted on the standalone video page, where `needs-purchase` buys the video.
   */
  courseId?: string;
}) {
  // SECURITY: `item.streamUid` is null for gated content here (the route strips
  // it for un-entitled viewers) so no bare Cloudflare uid is shipped to the
  // client. `posterFor` then falls back to `customPosterUrl` or renders no
  // poster at all — never a uid-bearing thumbnail URL an attacker could replay.
  const poster = posterFor(item, 1280);
  const message =
    access.reason === "needs-purchase"
      ? "This video is available to purchase."
      : access.reason === "needs-signin"
        ? "Sign in to access this video."
        : "This video is for members only.";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-glass-border bg-muted">
      {poster && (
        <img
          src={poster}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm"
        />
      )}
      <div className="absolute inset-0 grid place-items-center bg-black/40 p-6 text-center">
        <div className="max-w-sm space-y-4">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10 text-white backdrop-blur">
            <Lock className="size-6" />
          </span>
          <h2 className="text-xl font-bold text-white">{message}</h2>
          <PaywallActions
            videoId={item.id}
            courseId={courseId}
            reason={
              access.reason as
                | "needs-subscription"
                | "needs-purchase"
                | "needs-signin"
            }
          />
        </div>
      </div>
    </div>
  );
}
