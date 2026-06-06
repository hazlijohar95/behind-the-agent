import { createFileRoute } from "@tanstack/react-router";
import { SetupWizard } from "@/components/admin/setup-wizard";
import { loadSetupStatus } from "@/server/setup";

export const Route = createFileRoute("/admin/setup")({
  loader: () => loadSetupStatus(),
  component: AdminSetupPage,
});

function AdminSetupPage() {
  const status = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Finish configuring your platform and add your first content.
        </p>
      </div>
      <SetupWizard status={status} />
    </div>
  );
}
