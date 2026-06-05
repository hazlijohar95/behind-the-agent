import { settingsRepo } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SettingsForm } from "@/components/admin/settings-form";

const loadSettings = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await settingsRepo.getSettings();
  return { settings };
});

export const Route = createFileRoute("/admin/settings")({
  loader: () => loadSettings(),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { settings } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure your platform.
        </p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
