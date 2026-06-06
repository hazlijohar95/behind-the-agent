import { getDb } from "../client";
import { tokenize } from "../id";
import { rowToVideo } from "../mappers";
import type { VideoWithStats } from "../types";

/**
 * A search hit: a full video row plus an optional transcript excerpt. The
 * excerpt is present only when the match came (at least partly) from spoken
 * content — letting the UI surface *where* a result matched without a second
 * round-trip. Title/description-only matches carry a `null` snippet.
 */
export type VideoSearchResult = VideoWithStats & {
  transcriptSnippet: string | null;
};

/**
 * A single contiguous run of transcript text. `match` marks the runs that
 * contain a query term so the UI can highlight them without re-parsing.
 */
export type TranscriptSnippetPart = {
  text: string;
  match: boolean;
};

// Words of context to keep on either side of the first matched term, and the
// hard cap on snippet length so a stray giant transcript can't bloat a payload.
const SNIPPET_CONTEXT_WORDS = 12;
const SNIPPET_MAX_CHARS = 320;

/**
 * Reduce a transcript word to the FTS-comparable terms it contains. Postgres'
 * `simple` config lowercases, folds accents, and splits on non-alphanumerics,
 * so "Cafe-style." yields ["cafe", "style"]. Comparing against tokenize()
 * output (which normalizes query terms the same way) keeps snippet matching in
 * step with what actually matched the `search` tsvector.
 */
function wordTerms(word: string): string[] {
  return word
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Whether a transcript word contains any of the query terms. */
function wordMatches(word: string, terms: Set<string>): boolean {
  return wordTerms(word).some((t) => terms.has(t));
}

/**
 * Build a short transcript excerpt centred on the first query term that occurs
 * in the transcript, returning `null` when no term matches (so the result
 * matched on title/description only). Matching mirrors the `simple` FTS config:
 * lowercase, whole-word, accent-insensitive — see {@link tokenize}.
 */
export function transcriptSnippet(
  transcript: string | null,
  query: string,
): string | null {
  if (!transcript) return null;
  const terms = tokenize(query);
  if (terms.length === 0) return null;

  const words = transcript.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const termSet = new Set(terms);
  const hit = words.findIndex((w) => wordMatches(w, termSet));
  if (hit === -1) return null;

  const start = Math.max(0, hit - SNIPPET_CONTEXT_WORDS);
  const end = Math.min(words.length, hit + SNIPPET_CONTEXT_WORDS + 1);

  let snippet = words.slice(start, end).join(" ");
  if (start > 0) snippet = `…${snippet}`;
  if (end < words.length) snippet = `${snippet}…`;

  if (snippet.length > SNIPPET_MAX_CHARS) {
    snippet = `${snippet.slice(0, SNIPPET_MAX_CHARS).trimEnd()}…`;
  }
  return snippet;
}

/**
 * Split a snippet into highlighted/plain parts so the UI can render matched
 * terms (`<mark>`) without using `dangerouslySetInnerHTML`. Matching reuses the
 * same normalization as {@link transcriptSnippet}.
 */
export function splitSnippet(
  snippet: string,
  query: string,
): TranscriptSnippetPart[] {
  const terms = new Set(tokenize(query));
  if (terms.size === 0) return [{ text: snippet, match: false }];

  // Split on word boundaries, keeping the separators so whitespace/punctuation
  // is preserved on re-join.
  const tokens = snippet.split(/(\s+)/);
  const parts: TranscriptSnippetPart[] = [];
  for (const tok of tokens) {
    if (tok === "") continue;
    const match = wordMatches(tok, terms);
    const prev = parts[parts.length - 1];
    // Coalesce adjacent parts of the same kind to keep the DOM small.
    if (prev && prev.match === match) prev.text += tok;
    else parts.push({ text: tok, match });
  }
  return parts;
}

/**
 * Full-text search across published, public videos (Postgres FTS), ranked by
 * popularity. The `search` tsvector already folds in the transcript (weight D,
 * see the transcripts migration), so spoken content is searchable here; `*`
 * returns the `transcript` text too, so we can attach a matching excerpt to
 * each hit. A single query owns both the visibility filters and the ordering,
 * and returns full rows — no second round-trip to re-fetch by id.
 */
export async function searchVideos(
  query: string,
): Promise<VideoSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await getDb()
    .from("videos")
    .select("*")
    .eq("publish_status", "published")
    .eq("visibility", "public")
    .textSearch("search", q, { type: "websearch", config: "simple" })
    .order("view_count", { ascending: false })
    .limit(50);
  return (data ?? []).map((row) => ({
    ...rowToVideo(row),
    transcriptSnippet: transcriptSnippet(row.transcript, q),
  }));
}
