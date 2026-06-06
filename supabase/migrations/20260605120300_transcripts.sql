-- ============================================================================
-- Video transcripts + full-text search integration.
--
-- Adds a `transcript` text column to public.videos (populated out-of-band by
-- the transcription pipeline) and folds it into the existing `search` tsvector
-- so full-text search covers spoken content, not just title/description.
--
-- `videos.search` is a GENERATED ALWAYS ... STORED column; Postgres does not
-- allow altering a generated expression in place, so we drop and recreate it
-- (and its GIN index). The config stays 'simple' to match the existing query
-- path (search repo uses .textSearch("search", q, { config: "simple" })).
-- Weights keep title/description ranked above transcript text.
-- ============================================================================

alter table public.videos
  add column if not exists transcript text;

-- Recreate the search vector to include the transcript. Drop the dependent
-- index first, then the generated column, then rebuild both.
drop index if exists public.videos_search_idx;

alter table public.videos drop column if exists search;

alter table public.videos
  add column search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(transcript, '')), 'D')
  ) stored;

create index videos_search_idx on public.videos using gin (search);
