import { getCurrentUser, isAdmin, type SessionUser } from "./session";

export function json(data: unknown, init?: number | ResponseInit) {
  return Response.json(
    data,
    typeof init === "number" ? { status: init } : init,
  );
}

/** No-op: caching is reintroduced later. */
export function bust(..._tags: string[]) {}

/** No-op: caching is reintroduced later. */
export function bustCatalog() {}

export function clientFingerprint(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "0.0.0.0";
  const ua = req.headers.get("user-agent") ?? "";
  return `${ip}:${ua.slice(0, 80)}`;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

/** Returns the signed-in user or a 401 response. */
export async function requireApiUser(): Promise<
  { user: SessionUser } | { response: Response }
> {
  const user = await getCurrentUser();
  if (!user) return { response: json({ error: "Unauthorized" }, 401) };
  if (user.banned)
    return { response: json({ error: "Account suspended" }, 403) };
  return { user };
}

/** Returns the admin user or a 401/403 response. */
export async function requireApiAdmin(): Promise<
  { user: SessionUser } | { response: Response }
> {
  const user = await getCurrentUser();
  if (!user) return { response: json({ error: "Unauthorized" }, 401) };
  if (!isAdmin(user)) return { response: json({ error: "Forbidden" }, 403) };
  return { user };
}
