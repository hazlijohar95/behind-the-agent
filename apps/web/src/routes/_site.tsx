import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BrandHeader, LandingFooter } from "@/components/home/landing";
import { getSettingsCached } from "@/lib/catalog";

const loadSiteLayout = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await getSettingsCached();
  return { siteName: settings.siteName };
});

export const Route = createFileRoute("/_site")({
  loader: () => loadSiteLayout(),
  component: SiteLayout,
});

function SiteLayout() {
  const { siteName } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col bg-btc-bg font-sans text-btc-text antialiased">
      <BrandHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <LandingFooter siteName={siteName} />
    </div>
  );
}
