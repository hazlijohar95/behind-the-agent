import type { AccessLevel } from "@btc/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CourseEntitlement,
  effectiveVideoAccess,
  monetizationEnabled,
  resolveCourseAccess,
  resolveWatchAccess,
} from "./entitlements";

/**
 * Access/entitlement core. This is the paywall. The functions under test decide
 * `allowed` (may the user watch) and `gated` (is this paid content). An inverted
 * branch here silently opens gated content to anonymous visitors, so every test
 * asserts the SECURE outcome for the bypass case (denied) as well as the happy
 * path (entitled → allowed).
 *
 * `monetizationEnabled()` reads process.env LAZILY on every call (POLAR_ENABLED
 * must be the string "true" AND POLAR_ACCESS_TOKEN must be set). We control both
 * env vars per test via vi.stubEnv (mutates process.env, auto-restored).
 *
 * NOTE on purity: `resolveCourseAccess`, `effectiveVideoAccess` and
 * `monetizationEnabled` are fully pure. `resolveWatchAccess` performs repo/
 * billing IO ONLY on paths where it can't short-circuit — specifically when a
 * signed-in user must be checked for a subscription or purchase. We therefore
 * exercise `resolveWatchAccess` only on its IO-FREE paths:
 *   (a) monetization disabled / free video → returns immediately, no IO;
 *   (b) anonymous user (user === null) on gated content → hasActiveSubscription
 *       returns false without IO (its `if (!user) return false` guard) and
 *       hasPurchase stays false because `user == null`, so no repo call fires.
 * The full subscriber/purchaser MATRIX is covered purely via resolveCourseAccess,
 * which shares the exact same internal `decideAccess` decision tree.
 */

function enableMonetization() {
  vi.stubEnv("POLAR_ENABLED", "true");
  vi.stubEnv("POLAR_ACCESS_TOKEN", "polar_test_token");
}

function disableMonetization() {
  vi.stubEnv("POLAR_ENABLED", "false");
  vi.stubEnv("POLAR_ACCESS_TOKEN", "");
}

beforeEach(() => {
  // Start every test from a known-OFF state; tests opt into monetization.
  disableMonetization();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ───────────────────────── monetizationEnabled ───────────────────────── */

describe("monetizationEnabled", () => {
  it("is true only when POLAR_ENABLED === 'true' AND a token is present", () => {
    enableMonetization();
    expect(monetizationEnabled()).toBe(true);
  });

  it("is false when the flag is on but the access token is missing", () => {
    vi.stubEnv("POLAR_ENABLED", "true");
    vi.stubEnv("POLAR_ACCESS_TOKEN", "");
    expect(monetizationEnabled()).toBe(false);
  });

  it("is false when a token exists but the flag is not the literal 'true'", () => {
    vi.stubEnv("POLAR_ENABLED", "1"); // truthy-looking but not "true"
    vi.stubEnv("POLAR_ACCESS_TOKEN", "polar_test_token");
    expect(monetizationEnabled()).toBe(false);
  });

  it("is false when nothing is configured", () => {
    disableMonetization();
    expect(monetizationEnabled()).toBe(false);
  });
});

/* ───────────────────────── resolveCourseAccess (pure matrix) ───────────────────────── */

const ANON: CourseEntitlement = {
  signedIn: false,
  hasSubscription: false,
  hasPurchasedCourse: false,
};
const SIGNED_IN_NOTHING: CourseEntitlement = {
  signedIn: true,
  hasSubscription: false,
  hasPurchasedCourse: false,
};
const SUBSCRIBER: CourseEntitlement = {
  signedIn: true,
  hasSubscription: true,
  hasPurchasedCourse: false,
};
const PURCHASER: CourseEntitlement = {
  signedIn: true,
  hasSubscription: false,
  hasPurchasedCourse: true,
};

describe("resolveCourseAccess — monetization OFF: everything open & ungated", () => {
  beforeEach(disableMonetization);

  for (const access of ["free", "subscribers", "purchase"] as const) {
    it(`access=${access} is allowed and ungated for an anonymous user`, () => {
      const r = resolveCourseAccess({ id: "c1", access }, ANON);
      expect(r).toEqual({ allowed: true, gated: false, reason: "free" });
    });
  }
});

describe("resolveCourseAccess — monetization ON", () => {
  beforeEach(enableMonetization);

  describe("free course", () => {
    it("is allowed and UNGATED for anonymous", () => {
      const r = resolveCourseAccess({ id: "c1", access: "free" }, ANON);
      expect(r).toEqual({ allowed: true, gated: false, reason: "free" });
    });
  });

  describe("subscribers-only course", () => {
    it("DENIES an anonymous viewer and asks them to sign in", () => {
      const r = resolveCourseAccess({ id: "c1", access: "subscribers" }, ANON);
      expect(r.allowed).toBe(false);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("needs-signin");
    });

    it("DENIES a signed-in non-subscriber and asks for a subscription", () => {
      const r = resolveCourseAccess(
        { id: "c1", access: "subscribers" },
        SIGNED_IN_NOTHING,
      );
      expect(r.allowed).toBe(false);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("needs-subscription");
    });

    it("DENIES a one-time course purchaser (a purchase is NOT a subscription)", () => {
      // A subscribers-only course must not be unlocked by a one-time purchase;
      // only an active subscription opens it.
      const r = resolveCourseAccess(
        { id: "c1", access: "subscribers" },
        PURCHASER,
      );
      expect(r.allowed).toBe(false);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("needs-subscription");
    });

    it("ALLOWS an active subscriber (gated but allowed)", () => {
      const r = resolveCourseAccess(
        { id: "c1", access: "subscribers" },
        SUBSCRIBER,
      );
      expect(r.allowed).toBe(true);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("subscriber");
    });
  });

  describe("purchase course", () => {
    it("DENIES an anonymous viewer and asks them to sign in", () => {
      const r = resolveCourseAccess({ id: "c1", access: "purchase" }, ANON);
      expect(r.allowed).toBe(false);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("needs-signin");
    });

    it("DENIES a signed-in user who neither subscribed nor bought it", () => {
      const r = resolveCourseAccess(
        { id: "c1", access: "purchase" },
        SIGNED_IN_NOTHING,
      );
      expect(r.allowed).toBe(false);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("needs-purchase");
    });

    it("ALLOWS a user who purchased this course", () => {
      const r = resolveCourseAccess(
        { id: "c1", access: "purchase" },
        PURCHASER,
      );
      expect(r.allowed).toBe(true);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("purchased");
    });

    it("ALLOWS a subscriber even without a purchase (sub is a superset)", () => {
      const r = resolveCourseAccess(
        { id: "c1", access: "purchase" },
        SUBSCRIBER,
      );
      expect(r.allowed).toBe(true);
      expect(r.gated).toBe(true);
      expect(r.reason).toBe("subscriber");
    });
  });
});

/* ───────── resolveWatchAccess: IO-free paths only (see file-top note) ───────── */

describe("resolveWatchAccess — IO-free paths", () => {
  it("free video is allowed & ungated even with monetization ON (no IO)", async () => {
    enableMonetization();
    const r = await resolveWatchAccess({ id: "v1", access: "free" }, null);
    expect(r).toEqual({ allowed: true, gated: false, reason: "free" });
  });

  it("monetization OFF: a 'purchase' video is open & ungated (short-circuit, no IO)", async () => {
    disableMonetization();
    const r = await resolveWatchAccess({ id: "v1", access: "purchase" }, null);
    expect(r).toEqual({ allowed: true, gated: false, reason: "free" });
  });

  it("ANONYMOUS user on a subscribers-only video is DENIED (needs-signin, no repo IO)", async () => {
    // user === null: hasActiveSubscription short-circuits to false with no
    // billing fetch, and hasPurchase stays false (user == null), so no
    // purchaseRepo call is made — this path is genuinely IO-free.
    enableMonetization();
    const r = await resolveWatchAccess(
      { id: "v1", access: "subscribers" },
      null,
    );
    expect(r.allowed).toBe(false);
    expect(r.gated).toBe(true);
    expect(r.reason).toBe("needs-signin");
  });

  it("ANONYMOUS user on a purchase video is DENIED (needs-signin, no repo IO)", async () => {
    enableMonetization();
    const r = await resolveWatchAccess({ id: "v1", access: "purchase" }, null);
    expect(r.allowed).toBe(false);
    expect(r.gated).toBe(true);
    expect(r.reason).toBe("needs-signin");
  });
});

/* ───────── effectiveVideoAccess: C1 side-door escalation (pure) ───────── */

describe("effectiveVideoAccess — escalates to the strictest backing course", () => {
  it("a free video backing NO course stays free", () => {
    expect(effectiveVideoAccess("free", [])).toBe("free");
  });

  it("a free lesson-backing video escalates to a subscribers course", () => {
    // The C1 hole: a lesson video defaults to access:free. Without escalation it
    // would play free at /v/$slug, bypassing the paid course. It must escalate.
    expect(effectiveVideoAccess("free", ["subscribers"])).toBe("subscribers");
  });

  it("a free lesson-backing video escalates to a purchase course (strictest wins)", () => {
    expect(
      effectiveVideoAccess("free", ["free", "subscribers", "purchase"]),
    ).toBe("purchase");
  });

  it("NEVER lowers access: a purchase video backing a free course stays purchase", () => {
    expect(effectiveVideoAccess("purchase", ["free"])).toBe("purchase");
  });

  it("NEVER lowers access: a purchase video backing a subscribers course stays purchase", () => {
    expect(effectiveVideoAccess("purchase", ["subscribers"])).toBe("purchase");
  });

  it("a subscribers video escalates to purchase when it backs a purchase course", () => {
    expect(effectiveVideoAccess("subscribers", ["purchase"])).toBe("purchase");
  });

  it("picks the single strictest among many backing courses", () => {
    const accesses: AccessLevel[] = ["free", "subscribers", "free"];
    expect(effectiveVideoAccess("free", accesses)).toBe("subscribers");
  });
});
