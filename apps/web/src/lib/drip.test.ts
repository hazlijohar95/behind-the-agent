import { describe, expect, it } from "vitest";
import { resolveLessonUnlock } from "./drip";

/**
 * Drip scheduling. The watch loader ANDs entitlement with `unlocked` before
 * minting a playback token, so a bug that returns `unlocked: true` early lets a
 * paying buyer (or worse) watch a dripped lesson before its release day. These
 * tests pin the unlock boundary and the days-remaining math.
 *
 * `resolveLessonUnlock` takes `now` as an explicit arg, so it is fully
 * deterministic with no clock mocking.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const START = 1_700_000_000_000; // arbitrary fixed "course started" epoch

describe("resolveLessonUnlock", () => {
  describe("drip off / no delay → always open", () => {
    it("unlocked when dripEnabled is false (even with a positive dripDays)", () => {
      const r = resolveLessonUnlock({
        dripEnabled: false,
        dripDays: 30,
        courseStartedAt: START,
        now: START, // day 0, would be locked if drip were on
      });
      expect(r).toEqual({ unlocked: true, unlocksInDays: 0, unlockAt: null });
    });

    it("unlocked when dripDays is 0", () => {
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 0,
        courseStartedAt: START,
        now: START,
      });
      expect(r.unlocked).toBe(true);
      expect(r.unlockAt).toBeNull();
    });

    it("unlocked when dripDays is negative (treated as no delay)", () => {
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: -5,
        courseStartedAt: START,
        now: START,
      });
      expect(r.unlocked).toBe(true);
    });
  });

  describe("dripped lesson, course already started", () => {
    it("is LOCKED the instant the course starts (day 0 of a 7-day drip)", () => {
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 7,
        courseStartedAt: START,
        now: START,
      });
      expect(r.unlocked).toBe(false);
      expect(r.unlocksInDays).toBe(7);
      expect(r.unlockAt).toBe(START + 7 * MS_PER_DAY);
    });

    it("is LOCKED one millisecond before the unlock instant", () => {
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 7,
        courseStartedAt: START,
        now: START + 7 * MS_PER_DAY - 1,
      });
      expect(r.unlocked).toBe(false);
      // 1ms remaining must still round UP to a whole day, never 0.
      expect(r.unlocksInDays).toBe(1);
    });

    it("is UNLOCKED exactly at the unlock instant (now === start + dripDays)", () => {
      // Boundary is inclusive: `now >= unlockAt` unlocks.
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 7,
        courseStartedAt: START,
        now: START + 7 * MS_PER_DAY,
      });
      expect(r.unlocked).toBe(true);
      expect(r.unlocksInDays).toBe(0);
    });

    it("is UNLOCKED well after the unlock instant", () => {
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 7,
        courseStartedAt: START,
        now: START + 30 * MS_PER_DAY,
      });
      expect(r.unlocked).toBe(true);
      expect(r.unlocksInDays).toBe(0);
    });

    it("reports whole days remaining with ceil (a partial day rounds up)", () => {
      // 2.4 days elapsed of a 7-day drip → 4.6 days left → ceil → 5.
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 7,
        courseStartedAt: START,
        now: START + Math.round(2.4 * MS_PER_DAY),
      });
      expect(r.unlocked).toBe(false);
      expect(r.unlocksInDays).toBe(5);
    });
  });

  describe("course not started (courseStartedAt = null) → starts now", () => {
    it("a day-0 (dripDays 0) lesson opens immediately for a not-started learner", () => {
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 0,
        courseStartedAt: null,
        now: START,
      });
      expect(r.unlocked).toBe(true);
    });

    it("a dripped lesson is locked and unlocks dripDays from now", () => {
      const r = resolveLessonUnlock({
        dripEnabled: true,
        dripDays: 3,
        courseStartedAt: null,
        now: START,
      });
      expect(r.unlocked).toBe(false);
      expect(r.unlocksInDays).toBe(3);
      // unlockAt anchors to `now` because there is no start timestamp yet.
      expect(r.unlockAt).toBe(START + 3 * MS_PER_DAY);
    });
  });
});
