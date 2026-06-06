import type { BillingRecord } from "@btc/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isActive } from "./billing";

/**
 * `isActive` is the gate that turns a billing row into "this user is a paying
 * subscriber". Every gated-content decision (resolveWatchAccess, the course
 * loaders) leans on it, so an inverted check here would open the paywall for
 * everyone with an expired/canceled subscription.
 *
 * Time-dependent: `currentPeriodEnd` is compared against `Date.now()`. We freeze
 * the clock so the boundary tests are deterministic.
 */

const NOW_MS = 1_700_000_000_000; // fixed wall clock for the suite
const NOW_S = Math.floor(NOW_MS / 1000);

function billing(overrides: Partial<BillingRecord>): BillingRecord {
  return {
    userId: "u1",
    polarCustomerId: "cus_1",
    status: "active",
    planId: "plan_1",
    currentPeriodEnd: NOW_S + 3600, // an hour in the future by default
    updatedAt: NOW_MS,
    ...overrides,
  };
}

describe("isActive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("denies when there is no billing record at all (anonymous / never subscribed)", () => {
    expect(isActive(null)).toBe(false);
  });

  it("denies when status is null", () => {
    expect(isActive(billing({ status: null }))).toBe(false);
  });

  it("denies a canceled subscription even if the period has not ended", () => {
    // A canceled sub whose period end is still in the future MUST be denied:
    // the status, not just the clock, has to say active/trialing.
    expect(
      isActive(
        billing({ status: "canceled", currentPeriodEnd: NOW_S + 99999 }),
      ),
    ).toBe(false);
  });

  it("denies a past_due subscription", () => {
    expect(isActive(billing({ status: "past_due" }))).toBe(false);
  });

  it("denies an unknown/garbage status", () => {
    expect(isActive(billing({ status: "incomplete_expired" }))).toBe(false);
  });

  it("allows an active subscription with a future period end", () => {
    expect(isActive(billing({ status: "active" }))).toBe(true);
  });

  it("allows a trialing subscription with a future period end", () => {
    expect(isActive(billing({ status: "trialing" }))).toBe(true);
  });

  it("allows an active subscription with no period end recorded (open-ended)", () => {
    expect(
      isActive(billing({ status: "active", currentPeriodEnd: null })),
    ).toBe(true);
  });

  it("denies an active subscription whose period already ended (expired)", () => {
    // currentPeriodEnd is in seconds; it is multiplied by 1000 and compared to
    // Date.now(). One second in the past must read as expired -> denied.
    expect(
      isActive(billing({ status: "active", currentPeriodEnd: NOW_S - 1 })),
    ).toBe(false);
  });

  it("allows at the exact period-end boundary (end == now is not yet expired)", () => {
    // Guard at `* 1000 < Date.now()`: equality is NOT expired. With
    // currentPeriodEnd === NOW_S, end*1000 === NOW_MS, so `< now` is false.
    expect(
      isActive(billing({ status: "active", currentPeriodEnd: NOW_S })),
    ).toBe(true);
  });

  it("denies one millisecond past the boundary", () => {
    // Move the wall clock 1ms past the period end; now end*1000 < Date.now().
    vi.setSystemTime(NOW_MS + 1);
    expect(
      isActive(billing({ status: "active", currentPeriodEnd: NOW_S })),
    ).toBe(false);
  });
});
