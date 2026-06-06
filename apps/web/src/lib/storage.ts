import { env } from "cloudflare:workers";
import { appUrl } from "./env";

export type Bucket = "thumbnails" | "branding";

// UUID-named objects are immutable, so cache them hard.
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * Upload a public file to the Cloudflare R2 bucket (Worker binding `MEDIA`) and
 * return its absolute URL, served by the app's own `/media/*` route.
 *
 * Native to the Worker — no Supabase Storage and no external bucket domain. The
 * `bucket` argument becomes a key prefix within the single R2 bucket
 * (`thumbnails/…`, `branding/…`).
 */
export async function uploadPublicFile(
  bucket: Bucket,
  path: string,
  file: File | Blob,
  contentType: string,
): Promise<string> {
  const key = `${bucket}/${path}`;
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType, cacheControl: IMMUTABLE },
  });
  return `${appUrl()}/media/${key}`;
}
