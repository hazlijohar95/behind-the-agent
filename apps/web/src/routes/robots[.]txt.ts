import { createFileRoute } from "@tanstack/react-router";

function baseUrl(): string {
  return (process.env.VITE_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        const base = baseUrl();
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
