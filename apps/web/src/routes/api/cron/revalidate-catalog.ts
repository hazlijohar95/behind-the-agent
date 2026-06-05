import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api";

/**
 * Catalog cache busting is a no-op now (Next data cache stripped;
 * caching is reintroduced later). Kept as an endpoint for parity.
 */
export const Route = createFileRoute("/api/cron/revalidate-catalog")({
  server: {
    handlers: {
      GET: async () => {
        return json({ ok: true });
      },
    },
  },
});
