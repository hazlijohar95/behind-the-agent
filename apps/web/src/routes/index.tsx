import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { LandingFooter, LandingHero } from "@/components/home/landing";
import { VideoBrowser } from "@/components/home/video-browser";
import { cachePublic } from "@/lib/cache";
import { getHomeCatalogCached, getSettingsCached } from "@/lib/catalog";

const loadHome = createServerFn({ method: "GET" }).handler(async () => {
  cachePublic();
  const [settings, catalog] = await Promise.all([
    getSettingsCached(),
    getHomeCatalogCached(),
  ]);

  return { settings, catalog };
});

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { category?: string } => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  loader: () => loadHome(),
  component: Home,
});

function Home() {
  const { settings, catalog } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-btc-bg font-sans text-btc-text antialiased">
      <LandingHero tagline={settings.tagline} />

      <section className="mx-auto w-full max-w-[1728px] px-4 py-16 sm:px-10">
        <VideoBrowser
          categories={catalog.categories}
          sections={catalog.sections}
          siteName={settings.siteName}
        />
      </section>

      <LandingFooter siteName={settings.siteName} />
    </div>
  );
}
