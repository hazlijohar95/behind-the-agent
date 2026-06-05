import { getDb } from "../client";
import { rowToVideo } from "../mappers";
import type { VideoWithStats } from "../types";

/**
 * Full-text search across published, public videos (Postgres FTS), ranked by
 * popularity. A single query owns both the visibility filters and the ordering,
 * and returns full rows — no second round-trip to re-fetch by id.
 */
export async function searchVideos(query: string): Promise<VideoWithStats[]> {
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
  return (data ?? []).map(rowToVideo);
}
