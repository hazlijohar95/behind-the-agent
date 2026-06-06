import { isDbConfigured, searchRepo } from "@btc/db";
import type { MediaItem } from "@btc/ui";
import { VideoGrid } from "@btc/ui/components/video-grid";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SearchBox } from "@/components/search-box";
import {
  type TranscriptMatch,
  TranscriptMatches,
} from "@/components/transcript-matches";
import { getCategoryMap, toMediaItem } from "@/lib/catalog";

const searchInput = z.object({ q: z.string().max(200).default("") });

type SearchResults = {
  items: MediaItem[];
  transcriptMatches: TranscriptMatch[];
};

const runSearch = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => searchInput.parse(input))
  .handler(async ({ data }): Promise<SearchResults> => {
    const q = data.q.trim();
    if (!q || !isDbConfigured()) {
      return { items: [], transcriptMatches: [] };
    }

    const results = await searchRepo.searchVideos(q);
    const categories = await getCategoryMap();

    const items: MediaItem[] = [];
    const transcriptMatches: TranscriptMatch[] = [];
    for (const v of results) {
      const item = toMediaItem(
        v,
        v.categoryId ? categories[v.categoryId] : null,
      );
      items.push(item);
      // Only results whose match included spoken content get an excerpt.
      if (v.transcriptSnippet) {
        transcriptMatches.push({
          item,
          parts: searchRepo.splitSnippet(v.transcriptSnippet, q),
        });
      }
    }

    return { items, transcriptMatches };
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
  const { items, transcriptMatches } = Route.useLoaderData();
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
          Type a query in the search box to find videos. We search titles,
          descriptions, and what&apos;s spoken in each video.
        </p>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-muted-foreground">
          No videos match “{query}”.
        </div>
      ) : (
        <div className="space-y-10">
          <VideoGrid items={items} priorityCount={4} />
          <TranscriptMatches matches={transcriptMatches} />
        </div>
      )}
    </div>
  );
}
