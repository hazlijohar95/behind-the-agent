import { videoRepo } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { getSettingsCached } from "@/lib/catalog";

function baseUrl(): string {
  return (process.env.VITE_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const base = baseUrl();
        let siteName = "Behind The Agents";
        let description = "Behind The Agents";
        let items = "";

        try {
          const [settings, page] = await Promise.all([
            getSettingsCached(),
            videoRepo.listPublished({ limit: 50, sort: "recent" }),
          ]);
          siteName = settings.siteName || siteName;
          description = settings.defaultDescription || siteName;
          items = page.items
            .map((v) => {
              const url = `${base}/v/${v.slug}`;
              const date = new Date(v.publishedAt ?? v.createdAt).toUTCString();
              return `    <item>
      <title>${esc(v.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${date}</pubDate>
      <description>${esc(v.description ?? "")}</description>
    </item>`;
            })
            .join("\n");
        } catch {
          // Serve a valid (empty) feed if the DB isn't reachable.
        }

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(siteName)}</title>
    <link>${base}</link>
    <description>${esc(description)}</description>
${items}
  </channel>
</rss>`;

        return new Response(body, {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control":
              "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
