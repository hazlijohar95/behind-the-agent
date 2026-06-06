import { categoryRepo, videoRepo } from "@btc/db";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { VideoEditor } from "@/components/admin/video-editor";
import { monetizationEnabled } from "@/lib/entitlements";
import { requireAdmin } from "@/lib/session";

const loadVideo = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    const [video, categories] = await Promise.all([
      videoRepo.getVideo(data.id),
      categoryRepo.listCategories(),
    ]);
    if (!video) throw notFound();
    return { video, categories, monetizationEnabled: monetizationEnabled() };
  });

export const Route = createFileRoute("/admin/videos/$id")({
  loader: ({ params }) => loadVideo({ data: { id: params.id } }),
  component: EditVideoPage,
});

function EditVideoPage() {
  const { video, categories, monetizationEnabled } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <VideoEditor
        video={video}
        categories={categories}
        monetizationEnabled={monetizationEnabled}
      />
    </div>
  );
}
