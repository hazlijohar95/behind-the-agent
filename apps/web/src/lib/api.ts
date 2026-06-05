import { getCurrentUser, isAdmin, type SessionUser } from "./session";

export function json(data: unknown, init?: number | ResponseInit) {
  return Response.json(
    data,
    typeof init === "number" ? { status: init } : init,
  );
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

export function clientFingerprint(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  return `${clientIp(req)}:${ua.slice(0, 80)}`;
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

type RouteCtx<P> = { request: Request; params: P };

async function guard(
  body: () => Promise<Response> | Response,
): Promise<Response> {
  try {
    return await body();
  } catch (err) {
    console.error("[api]", err);
    return json({ error: "Something went wrong" }, 500);
  }
}

/**
 * Wraps a server-route handler so any thrown error becomes a clean JSON 500
 * instead of leaking a stack trace. Pass the route's param shape explicitly,
 * e.g. `apiRoute<{ id: string }>(({ params }) => ...)`.
 */
export function apiRoute<P = Record<string, string>>(
  handler: (ctx: RouteCtx<P>) => Promise<Response> | Response,
): (ctx: RouteCtx<P>) => Promise<Response> {
  return (ctx) => guard(() => handler(ctx));
}

/**
 * Like `apiRoute`, but first resolves the signed-in user ("user") or admin
 * ("admin"), short-circuiting with 401/403 before the handler runs. The handler
 * receives the resolved `user`.
 */
export function authedRoute<P = Record<string, string>>(
  mode: "user" | "admin",
  handler: (
    ctx: RouteCtx<P> & { user: SessionUser },
  ) => Promise<Response> | Response,
): (ctx: RouteCtx<P>) => Promise<Response> {
  return async (ctx) => {
    const auth =
      mode === "admin" ? await requireApiAdmin() : await requireApiUser();
    if ("response" in auth) return auth.response;
    return guard(() => handler({ ...ctx, user: auth.user }));
  };
}
