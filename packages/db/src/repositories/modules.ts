import { getDb } from "../client";
import type { Database } from "../database.types";
import type { Module } from "../types";

type Tables = Database["public"]["Tables"];
type ModuleRow = Tables["modules"]["Row"];
type ModuleUpdate = Tables["modules"]["Update"];

function toMs(ts: string | null): number | null {
  return ts ? new Date(ts).getTime() : null;
}

export function rowToModule(r: ModuleRow): Module {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    description: r.description ?? "",
    position: r.position,
    createdAt: toMs(r.created_at) ?? 0,
    updatedAt: toMs(r.updated_at) ?? 0,
  };
}

export async function getModule(id: string): Promise<Module | null> {
  const { data } = await getDb()
    .from("modules")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToModule(data) : null;
}

/** Modules of a course, in display order. */
export async function listByCourse(courseId: string): Promise<Module[]> {
  const { data } = await getDb()
    .from("modules")
    .select("*")
    .eq("course_id", courseId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map(rowToModule);
}

/** Next free position so a new module appends to the end of the course. */
async function nextPosition(courseId: string): Promise<number> {
  const { data } = await getDb()
    .from("modules")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? data.position + 1 : 0;
}

export async function createModule(input: {
  courseId: string;
  title: string;
  description?: string;
}): Promise<Module> {
  const position = await nextPosition(input.courseId);
  const { data, error } = await getDb()
    .from("modules")
    .insert({
      course_id: input.courseId,
      title: input.title,
      description: input.description ?? "",
      position,
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "Failed to create module");
  return rowToModule(data);
}

export async function updateModule(
  id: string,
  patch: { title?: string; description?: string; position?: number },
): Promise<Module | null> {
  const update: ModuleUpdate = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.position !== undefined) update.position = patch.position;
  const { data } = await getDb()
    .from("modules")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  return data ? rowToModule(data) : null;
}

export async function deleteModule(id: string): Promise<void> {
  // lessons cascade via FK ON DELETE CASCADE.
  await getDb().from("modules").delete().eq("id", id);
}

/**
 * Persist a new ordering for a course's modules. Applies the caller-supplied
 * id→position map in one round-trip per row; ids not belonging to the course
 * are scoped out by the `course_id` predicate so a forged id can't touch
 * another course's modules.
 */
export async function reorder(
  courseId: string,
  order: { id: string; position: number }[],
): Promise<void> {
  const db = getDb();
  await Promise.all(
    order.map(({ id, position }) =>
      db
        .from("modules")
        .update({ position })
        .eq("id", id)
        .eq("course_id", courseId),
    ),
  );
}
