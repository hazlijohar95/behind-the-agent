import { getDb } from "../client";
import type { Profile } from "../types";

const COLUMNS = "id, name, email, image, role, banned, created_at";

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  created_at: string | null;
};

function mapProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    name: r.name ?? "",
    email: r.email ?? "",
    image: r.image ?? null,
    role: r.role ?? "user",
    banned: Boolean(r.banned),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await getDb()
    .from("profiles")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return data ? mapProfile(data) : null;
}

/** Most-recently-created profiles first. */
export async function listProfiles(limit = 200): Promise<Profile[]> {
  const { data } = await getDb()
    .from("profiles")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapProfile);
}

export async function countAdmins(): Promise<number> {
  const { count } = await getDb()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return count ?? 0;
}

/** Update the display name, mirroring it into auth user_metadata. */
export async function setName(id: string, name: string): Promise<void> {
  const db = getDb();
  await db.from("profiles").update({ name }).eq("id", id);
  await db.auth.admin.updateUserById(id, { user_metadata: { name } });
}

/** Set the role, mirroring into app_metadata so JWT-based checks stay in sync. */
export async function setRole(
  id: string,
  role: "admin" | "user",
): Promise<void> {
  const db = getDb();
  await db.from("profiles").update({ role }).eq("id", id);
  await db.auth.admin.updateUserById(id, { app_metadata: { role } });
}

/** Ban/unban, mirroring into the auth user's ban_duration. */
export async function setBanned(id: string, banned: boolean): Promise<void> {
  const db = getDb();
  await db.from("profiles").update({ banned }).eq("id", id);
  await db.auth.admin.updateUserById(id, {
    ban_duration: banned ? "876000h" : "none",
  });
}
