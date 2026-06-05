import { profileRepo } from "@btc/db";
import { redirect } from "@tanstack/react-router";
import { createSupabaseServerClient } from "./supabase/server";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  emailVerified?: boolean;
  polarCustomerId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionPlanId?: string | null;
  currentPeriodEnd?: number | null;
};

/**
 * Returns the current request's user (verified JWT claims + authoritative
 * profile row), or null. `getClaims()` validates the token signature against
 * the project's published keys, so it's safe to trust in server code.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  // Authoritative role/profile data lives in the profiles table (service role).
  const profile = await profileRepo.getProfile(claims.sub);

  const metaRole =
    (claims.app_metadata as { role?: string } | undefined)?.role ?? null;
  const claimEmail = typeof claims.email === "string" ? claims.email : null;

  return {
    id: claims.sub,
    name: profile?.name ?? "",
    email: profile?.email || claimEmail || "",
    image: profile?.image ?? null,
    role: profile?.role ?? metaRole ?? "user",
    banned: profile?.banned ?? false,
    emailVerified: true,
  };
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin";
}

/** For admin pages: redirect non-admins. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw redirect({ to: "/login", search: { redirect: "/admin" } });
  if (!isAdmin(user)) throw redirect({ to: "/" });
  return user;
}

/** For viewer pages requiring any signed-in user. */
export async function requireUser(redirectTo = "/login"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw redirect({ to: redirectTo });
  return user;
}
