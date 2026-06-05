import { createFileRoute } from "@tanstack/react-router";
import { appUrl } from "@/lib/env";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        const base = appUrl();
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /account",
          "Disallow: /api",
          "",
          `Sitemap: ${base}/sitemap.xml`,
          "",
        ].join("\n");

        return new Response(body, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
