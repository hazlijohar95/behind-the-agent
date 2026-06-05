import { coerceVideoSort } from "@btc/db";
import { VideoGrid } from "@btc/ui/components/video-grid";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SortTabs } from "@/components/sort-tabs";
import { cachePublic } from "@/lib/cache";
import { getCategoryBySlugCached, getFeed } from "@/lib/catalog";

const loadCategory = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; sort: unknown }) => ({
    slug: String(input.slug),
    sort: coerceVideoSort(input.sort),
  }))
  .handler(async ({ data }) => {
    const category = await getCategoryBySlugCached(data.slug);
    if (!category) throw notFound();

    const feed = await getFeed({
      sort: data.sort,
      categoryId: category.id,
      limit: 24,
    });

    cachePublic();
    return { category, feed, sort: data.sort };
  });

export const Route = createFileRoute("/_site/category/$slug")({
  validateSearch: (search: Record<string, unknown>): { sort?: string } => ({
    sort: typeof search.sort === "string" ? search.sort : undefined,
  }),
  loaderDeps: ({ search }) => ({ sort: search.sort ?? "recent" }),
  loader: ({ params, deps }) =>
    loadCategory({ data: { slug: params.slug, sort: deps.sort } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.category.name },
          {
            name: "description",
            content:
              loaderData.category.description ||
              `Videos in ${loaderData.category.name}`,
          },
        ]
      : [],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { category, feed, sort } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Category</p>
        <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground">{category.description}</p>
        )}
      </div>
      <SortTabs basePath={`/category/${slug}`} current={sort} />
      {feed.items.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-muted-foreground">
          No videos here yet.
        </div>
      ) : (
        <VideoGrid items={feed.items} priorityCount={4} />
      )}
    </div>
  );
}
