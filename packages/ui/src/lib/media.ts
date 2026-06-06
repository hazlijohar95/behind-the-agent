/** Minimal shape the UI needs to render a video — decoupled from the db package. */
export type MediaItem = {
  id: string;
  title: string;
  slug: string;
  streamUid: string | null;
  thumbnailTime?: number | null;
  customPosterUrl?: string | null;
  duration?: number | null;
  views?: number;
  likes?: number;
  categoryName?: string | null;
  access?: "free" | "subscribers" | "purchase";
  createdAt?: number;
};

// Cloudflare Stream serves thumbnails from the account's customer subdomain.
// The code is public (safe to inline into the client bundle).
const CUSTOMER_CODE = import.meta.env.VITE_STREAM_CUSTOMER_CODE ?? "";
const STREAM_HOST = `https://customer-${CUSTOMER_CODE}.cloudflarestream.com`;

export type ThumbnailOptions = {
  /** Seconds into the video to grab the frame from. */
  time?: number;
  width?: number;
  height?: number;
  /** Resize mode, e.g. "crop" | "clip" | "scale-down" | "contain". */
  fit?: string;
  /** Signed token for gated videos (used in place of the bare uid). */
  token?: string;
};

/** Cloudflare Stream still-thumbnail (JPG) URL for a video uid. */
export function streamThumbnailUrl(
  uid: string,
  opts: ThumbnailOptions = {},
): string {
  const id = opts.token ?? uid;
  const params = new URLSearchParams();
  if (opts.time != null) params.set("time", `${opts.time}s`);
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  if (opts.fit) params.set("fit", opts.fit);
  const qs = params.toString();
  return `${STREAM_HOST}/${id}/thumbnails/thumbnail.jpg${qs ? `?${qs}` : ""}`;
}

/** Cloudflare Stream animated preview (GIF) URL for a video uid. */
export function streamAnimatedUrl(
  uid: string,
  opts: { width?: number } = {},
): string {
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  const qs = params.toString();
  return `${STREAM_HOST}/${uid}/thumbnails/thumbnail.gif${qs ? `?${qs}` : ""}`;
}

/**
 * Best poster URL for a media item: a custom poster if set, else a Cloudflare
 * Stream still from the bare uid, else null.
 *
 * SECURITY: a bare-uid thumbnail URL exposes the uid, and an unsigned uid plays
 * the full video at Cloudflare for a public-policy video — so for GATED content
 * the caller MUST pass `streamUid: null` (relying on `customPosterUrl` only).
 * This helper then never builds a uid-bearing URL. The watch routes do exactly
 * that for un-entitled viewers; see `Paywall`.
 */
export function posterFor(item: MediaItem, width = 640): string | null {
  if (item.customPosterUrl) return item.customPosterUrl;
  if (!item.streamUid) return null;
  return streamThumbnailUrl(item.streamUid, {
    width,
    time: item.thumbnailTime ?? undefined,
  });
}

export function animatedFor(item: MediaItem, width = 480): string | null {
  if (!item.streamUid) return null;
  return streamAnimatedUrl(item.streamUid, { width });
}
