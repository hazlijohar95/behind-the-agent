import {
  type AccessLevel,
  type Course,
  courseRepo,
  purchaseRepo,
  type Video,
} from "@btc/db";
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

/** The two monetization facts an access decision depends on, pre-resolved. */
type AccessFacts = {
  signedIn: boolean;
  hasSubscription: boolean;
  /** Has a one-time purchase for this specific item (video or course). */
  hasPurchase: boolean;
};

/**
 * The single, pure access decision shared by videos and courses. Takes an
 * access level plus the already-resolved entitlement facts and returns the
 * allow/gate/reason verdict. No IO, no repo or billing calls — callers fetch
 * the facts (or inject them) and pass them in. When monetization is disabled
 * everything is open and ungated, matching `resolveWatchAccess`'s original
 * behavior exactly (no regression).
 */
function decideAccess(access: AccessLevel, facts: AccessFacts): WatchAccess {
  if (!monetizationEnabled() || access === "free") {
    return { allowed: true, gated: false, reason: "free" };
  }

  if (access === "subscribers") {
    if (facts.hasSubscription)
      return { allowed: true, gated: true, reason: "subscriber" };
    return {
      allowed: false,
      gated: true,
      reason: facts.signedIn ? "needs-subscription" : "needs-signin",
    };
  }

  // access === "purchase": a subscriber gets in, otherwise a matching purchase.
  if (facts.hasSubscription)
    return { allowed: true, gated: true, reason: "subscriber" };
  if (facts.hasPurchase)
    return { allowed: true, gated: true, reason: "purchased" };
  return {
    allowed: false,
    gated: true,
    reason: facts.signedIn ? "needs-purchase" : "needs-signin",
  };
}

export async function resolveWatchAccess(
  video: Pick<Video, "id" | "access">,
  user: SessionUser | null,
): Promise<WatchAccess> {
  // Short-circuit IO when the verdict can't depend on it.
  if (!monetizationEnabled() || video.access === "free") {
    return { allowed: true, gated: false, reason: "free" };
  }
  const hasSubscription = await hasActiveSubscription(user);
  const hasPurchase =
    video.access === "purchase" && !hasSubscription && user != null
      ? await purchaseRepo.hasPurchased(user.id, video.id)
      : false;
  return decideAccess(video.access, {
    signedIn: user != null,
    hasSubscription,
    hasPurchase,
  });
}

/* ───────────────────────── Course-level access ───────────────────────── */

/** Course access verdict — identical shape/reasons to {@link WatchAccess}. */
export type CourseAccess = WatchAccess;

/**
 * Entitlement facts for a course access decision, resolved by the caller.
 * Kept as injected args (not fetched here) so this resolver is a pure function
 * with no repo/billing import — the lesson watch page / progress server fns
 * supply these from billing + a course-purchase lookup.
 */
export type CourseEntitlement = {
  signedIn: boolean;
  hasSubscription: boolean;
  /** Whether the user holds a one-time purchase for this course. */
  hasPurchasedCourse: boolean;
};

/**
 * Resolve whether a user may watch a course's lessons. PURE: it performs no IO
 * and imports no repository — it mirrors {@link resolveWatchAccess}'s decision
 * tree (free | subscribers | purchase) over caller-supplied entitlement facts.
 *
 * The lesson watch loader MUST call this and gate playback exactly like the H2
 * fix requires (never emit a bare streamUid for a gated lesson lacking a signed
 * token). The progress beacon endpoint does not need to re-run this for write
 * safety — the save RPC binds writes to the authed user and validates the
 * lesson is published — but recording progress for an un-watchable lesson is
 * harmless, so the client may also short-circuit when `allowed` is false.
 */
export function resolveCourseAccess(
  course: Pick<Course, "id" | "access">,
  entitlement: CourseEntitlement,
): CourseAccess {
  return decideAccess(course.access, {
    signedIn: entitlement.signedIn,
    hasSubscription: entitlement.hasSubscription,
    hasPurchase: entitlement.hasPurchasedCourse,
  });
}

/* ───────────── Effective access for a standalone video (C1 side-door) ───────────── */

/** Gating strictness order: a higher number is more restrictive. */
const ACCESS_RANK: Record<AccessLevel, number> = {
  free: 0,
  subscribers: 1,
  purchase: 2,
};

/**
 * The effective access level for playing a video on the *standalone* watch page
 * (`/v/$slug`), given the video's own access and the access levels of any
 * published, gated course whose lesson the video backs.
 *
 * PURE. This closes the C1 paywall side-door: a lesson-backing video is created
 * with `access: "free"` by default, so without this a paid course's lessons
 * would play for free at `/v/$slug` (which gates only on the video's own
 * access). We escalate a free video to the STRICTEST backing course access, so
 * the standalone page demands at least the same entitlement the course landing
 * page does. A video that is already gated, or backs only free/ungated courses,
 * is unchanged — no regression for non-course or free-course videos.
 *
 * We never *lower* access (max, not min): if the video itself is `purchase` we
 * keep `purchase` even when it also backs a free course.
 */
export function effectiveVideoAccess(
  videoAccess: AccessLevel,
  backingCourseAccesses: readonly AccessLevel[],
): AccessLevel {
  let rank = ACCESS_RANK[videoAccess];
  let result = videoAccess;
  for (const courseAccess of backingCourseAccesses) {
    if (ACCESS_RANK[courseAccess] > rank) {
      rank = ACCESS_RANK[courseAccess];
      result = courseAccess;
    }
  }
  return result;
}

/** A published, gated course (id + access) whose lesson a video backs. */
export type BackingCourse = { id: string; access: AccessLevel };

/**
 * Resolve whether a user may watch a standalone video page, accounting for the
 * C1 side-door: if the video backs a gated course's published lesson, gating
 * uses the strictest of the video's own access and that course access (so the
 * `/v/$slug` page can't be used to bypass a paid course).
 *
 * Short-circuits exactly like {@link resolveWatchAccess} when monetization is
 * off or the resolved access is free. `backingCourses` are supplied by the
 * caller (from `lessonRepo.listPublishedLessonCoursesByVideo`). A one-time
 * entitlement is honored from the video's own purchase OR any backing course
 * purchase, so a course buyer can still watch its lessons here.
 */
export async function resolveStandaloneVideoAccess(
  video: Pick<Video, "id" | "access">,
  user: SessionUser | null,
  backingCourses: readonly BackingCourse[],
): Promise<WatchAccess> {
  const access = effectiveVideoAccess(
    video.access,
    backingCourses.map((c) => c.access),
  );

  if (!monetizationEnabled() || access === "free") {
    return { allowed: true, gated: false, reason: "free" };
  }
  const hasSubscription = await hasActiveSubscription(user);
  // A one-time entitlement can come from the video itself OR any backing course
  // (a course buyer must be able to watch its lessons on the standalone page).
  let hasPurchase = false;
  if (access === "purchase" && !hasSubscription && user != null) {
    hasPurchase = await purchaseRepo.hasPurchased(user.id, video.id);
    if (!hasPurchase && backingCourses.length > 0) {
      const owned = new Set(await courseRepo.listPurchasedCourseIds(user.id));
      hasPurchase = backingCourses.some((c) => owned.has(c.id));
    }
  }
  return decideAccess(access, {
    signedIn: user != null,
    hasSubscription,
    hasPurchase,
  });
}
