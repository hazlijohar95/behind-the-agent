import { purchaseRepo, type Video } from "@btc/db";
import { getBilling, isActive } from "./billing";
import type { SessionUser } from "./session";

/**
 * Whether paid monetization (Polar) is configured. Resolved lazily — reading
 * `process.env` at module top-level returns empty values on the Workers runtime
 * (env is only populated per-request), which would silently disable monetization
 * in production. Always call this; never cache the result at module scope.
 */
export function monetizationEnabled(): boolean {
  return (
    process.env.POLAR_ENABLED === "true" &&
    Boolean(process.env.POLAR_ACCESS_TOKEN)
  );
}

export type WatchAccess = {
  allowed: boolean;
  gated: boolean;
  reason:
    | "free"
    | "subscriber"
    | "purchased"
    | "needs-subscription"
    | "needs-purchase"
    | "needs-signin";
};

async function hasActiveSubscription(
  user: SessionUser | null,
): Promise<boolean> {
  if (!user) return false;
  return isActive(await getBilling(user.id));
}

export async function resolveWatchAccess(
  video: Pick<Video, "id" | "access">,
  user: SessionUser | null,
): Promise<WatchAccess> {
  if (!monetizationEnabled() || video.access === "free") {
    return { allowed: true, gated: false, reason: "free" };
  }

  if (video.access === "subscribers") {
    if (await hasActiveSubscription(user))
      return { allowed: true, gated: true, reason: "subscriber" };
    return {
      allowed: false,
      gated: true,
      reason: user ? "needs-subscription" : "needs-signin",
    };
  }

  // access === "purchase"
  if (await hasActiveSubscription(user))
    return { allowed: true, gated: true, reason: "subscriber" };
  if (user && (await purchaseRepo.hasPurchased(user.id, video.id))) {
    return { allowed: true, gated: true, reason: "purchased" };
  }
  return {
    allowed: false,
    gated: true,
    reason: user ? "needs-purchase" : "needs-signin",
  };
}
