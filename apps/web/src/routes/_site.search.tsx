import { VideoGrid } from "@btc/ui/components/video-grid";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SearchBox } from "@/components/search-box";
import { searchVideos } from "@/lib/catalog";

const runSearch = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => input)
  .handler(async ({ data }) => {
    const results = await searchVideos(data.q);
    return { results };
  });

export const Route = createFileRoute("/_site/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
  loader: ({ deps }) => runSearch({ data: { q: deps.q } }),
  head: () => ({
    // Query-specific results — keep them out of search-engine indexes.
    meta: [{ title: "Search" }, { name: "robots", content: "noindex" }],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { results } = Route.useLoaderData();
  const query = q?.trim() ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Search</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {query ? `Results for “${query}”` : "Search videos"}
        </h1>
      </div>

      <SearchBox defaultValue={query} autoFocus className="max-w-xl" />

      {!query ? (
        <p className="text-muted-foreground">
          Type a query in the search box to find videos.
        </p>
      ) : results.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-muted-foreground">
          No videos match “{query}”.
        </div>
      ) : (
        <VideoGrid items={results} priorityCount={4} />
      )}
    </div>
  );
}
