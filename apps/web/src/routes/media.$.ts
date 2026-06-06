import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Public media served straight from the R2 bucket binding (`MEDIA`) on the
 * app's own origin — replaces Supabase Storage's public bucket URLs. Objects are
 * written by lib/storage.ts under `thumbnails/…` / `branding/…` prefixes and
 * are immutable (UUID-named), so they cache hard at the edge.
 */
export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = decodeURIComponent(
          new URL(request.url).pathname.replace(/^\/media\//, ""),
        );
        // Reject empty keys and any path-traversal attempt.
        if (!key || key.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const object = await env.MEDIA.get(key);
        if (!object) return new Response("Not found", { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers); // content-type + cache-control from upload
        headers.set("etag", object.httpEtag);
        if (!headers.has("cache-control")) {
          headers.set("cache-control", "public, max-age=31536000, immutable");
        }
        return new Response(object.body, { headers });
      },
    },
  },
});
