import { type MediaItem, posterFor } from "@btc/ui";
import { Link } from "@tanstack/react-router";
import { Captions } from "lucide-react";

/**
 * One run of a transcript excerpt; `match` runs contain a query term and get
 * highlighted. Structurally identical to the search repo's `TranscriptSnippetPart`
 * but declared here so this client component carries no db-package import.
 */
export type SnippetPart = {
  text: string;
  match: boolean;
};

/**
 * A single transcript hit: the video it belongs to and the spoken excerpt,
 * pre-split into highlighted/plain runs by the search repo so we never inject
 * HTML (no `dangerouslySetInnerHTML`).
 */
export type TranscriptMatch = {
  item: MediaItem;
  parts: SnippetPart[];
};

/**
 * Surfaces results that matched on spoken content. Sits alongside the regular
 * video grid so a viewer can see *where* in a video their query was said and
 * jump straight to it.
 */
export function TranscriptMatches({ matches }: { matches: TranscriptMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="Transcript matches">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Captions className="size-4" />
        <span>Spoken in these videos</span>
      </div>

      <ul className="space-y-3">
        {matches.map(({ item, parts }) => (
          <li key={item.id}>
            <Link
              to="/v/$slug"
              params={{ slug: item.slug }}
              className="glass group flex gap-4 rounded-xl p-3 transition-colors hover:bg-secondary/40"
            >
              <Thumbnail item={item} />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="line-clamp-1 text-sm font-medium group-hover:underline">
                  {item.title}
                </h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  <SnippetText parts={parts} />
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Renders the snippet runs, highlighting matched terms with `<mark>`. Keys use
 * each run's running character offset — unique and stable for a given snippet,
 * so React can reconcile without falling back to array indices.
 */
function SnippetText({ parts }: { parts: SnippetPart[] }) {
  let offset = 0;
  return (
    <>
      {parts.map((part) => {
        const key = offset;
        offset += part.text.length;
        return part.match ? (
          <mark
            key={key}
            className="rounded bg-primary/20 px-0.5 text-foreground"
          >
            {part.text}
          </mark>
        ) : (
          <span key={key}>{part.text}</span>
        );
      })}
    </>
  );
}

function Thumbnail({ item }: { item: MediaItem }) {
  const poster = posterFor(item, 320);
  return (
    <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-36">
      {poster ? (
        <img
          src={poster}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}
