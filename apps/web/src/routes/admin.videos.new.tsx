import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UploadVideo } from "@/components/admin/upload-video";
import { monetizationEnabled } from "@/lib/entitlements";
import { requireAdmin } from "@/lib/session";

const loadNewVideo = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  return { monetizationEnabled: monetizationEnabled() };
});

export const Route = createFileRoute("/admin/videos/new")({
  loader: () => loadNewVideo(),
  component: NewVideoPage,
});

function NewVideoPage() {
  const { monetizationEnabled } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Upload video
        </h1>
        <p className="text-sm text-muted-foreground">
          Give it a title, then upload. We&apos;ll generate captions
          automatically.
        </p>
      </div>
      <UploadVideo monetizationEnabled={monetizationEnabled} />
    </div>
  );
}
