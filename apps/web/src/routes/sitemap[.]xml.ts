import { createFileRoute } from "@tanstack/react-router";
import {
  getCategorySlugsCached,
  getPublishedVideoSlugsCached,
} from "@/lib/catalog";
import { appUrl } from "@/lib/env";

type UrlEntry = {
  loc: string;
  changeFrequency?: string;
  priority?: number;
};

function renderUrl(base: string, entry: UrlEntry): string {
  const parts = [`    <loc>${base}${entry.loc}</loc>`];
  if (entry.changeFrequency) {
    parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
  }
  if (entry.priority != null) {
    parts.push(`    <priority>${entry.priority}</priority>`);
  }
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const base = appUrl();
        const staticRoutes: UrlEntry[] = [
          { loc: "/", changeFrequency: "daily", priority: 1 },
          { loc: "/about", changeFrequency: "monthly", priority: 0.3 },
          { loc: "/terms", changeFrequency: "yearly", priority: 0.2 },
          { loc: "/privacy", changeFrequency: "yearly", priority: 0.2 },
        ];

        let entries = staticRoutes;
        try {
          const [videoSlugs, categorySlugs] = await Promise.all([
            getPublishedVideoSlugsCached(),
            getCategorySlugsCached(),
          ]);

          const videoRoutes: UrlEntry[] = videoSlugs.map((slug) => ({
            loc: `/v/${slug}`,
            changeFrequency: "weekly",
            priority: 0.8,
          }));
          const categoryRoutes: UrlEntry[] = categorySlugs.map((slug) => ({
            loc: `/category/${slug}`,
            changeFrequency: "weekly",
            priority: 0.5,
          }));

          entries = [...staticRoutes, ...videoRoutes, ...categoryRoutes];
        } catch {
          entries = staticRoutes;
        }

        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
          .map((entry) => renderUrl(base, entry))
          .join("\n")}\n</urlset>`;

        return new Response(body, {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
