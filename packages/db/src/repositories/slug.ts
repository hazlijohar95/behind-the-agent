import { getDb } from "../client";
import { slugify } from "../id";

/**
 * Resolve a slug for `base` that is unique within `table`, in a SINGLE query.
 *
 * Fetches every existing slug sharing the root (`root%`) and picks the lowest
 * free numeric suffix in memory — avoiding the per-candidate round-trip (one
 * `select` per attempt) and the check-then-insert behaviour of a sequential
 * probe loop. `excludeId` lets an update keep its own current slug.
 */
export async function uniqueSlug(
  table: "videos" | "categories",
  base: string,
  fallback: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || fallback;
  let query = getDb().from(table).select("slug, id").like("slug", `${root}%`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;

  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
