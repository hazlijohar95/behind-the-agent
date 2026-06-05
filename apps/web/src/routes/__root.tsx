import { ThemeProvider } from "@btc/ui";
import { Toaster } from "@btc/ui/components/toaster";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DeployBanner } from "@/components/home/deploy-banner";
import { NotFound, RouteError } from "@/components/route-states";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Behind The Agents" },
      {
        name: "description",
        content: "A beautiful, single-publisher video platform.",
      },
      { property: "og:title", content: "Behind The Agents" },
      { property: "og:site_name", content: "Behind The Agents" },
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content: "A beautiful, single-publisher video platform.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Web fonts, loaded from Google Fonts.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=Hedvig+Letters+Serif&display=swap",
      },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: RouteError,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <DeployBanner />
          {children}
          <Toaster />
        </ThemeProvider>
        {/* Cloudflare Web Analytics (privacy-first, free) — loads only when a
            beacon token is configured. Replaces the removed Vercel analytics. */}
        {import.meta.env.VITE_CF_ANALYTICS_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({
              token: import.meta.env.VITE_CF_ANALYTICS_TOKEN,
            })}
          />
        )}
        <Scripts />
      </body>
    </html>
  );
}
