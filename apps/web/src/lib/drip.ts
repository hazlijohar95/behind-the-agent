/**
 * Drip scheduling for course lessons (CRITICAL finding: drip was cosmetic).
 *
 * A lesson can be configured to unlock `dripDays` after the learner starts the
 * course. "Course start" is the earliest moment we can attribute to the learner
 * beginning the course — the first lesson-progress timestamp (see
 * `progressRepo.getCourseStartedAt`), falling back to "now" for a learner who
 * is entitled but hasn't touched a lesson yet (so day-0 lessons open
 * immediately and a dripped lesson opens `dripDays` later).
 *
 * This module is PURE (no IO): the watch loader resolves the course-start
 * timestamp and passes it in, so the unlock math is unit-testable and the same
 * rule drives both the watch gate (token minting) and the curriculum's
 * `unlocked` flag.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type LessonUnlock = {
  /** Whether the lesson is open to the (already-entitled) learner right now. */
  unlocked: boolean;
  /** Whole days remaining until unlock (0 when already unlocked). */
  unlocksInDays: number;
  /** Absolute unlock time (ms epoch), or null when there is no drip delay. */
  unlockAt: number | null;
};

/**
 * Compute a lesson's drip unlock state for an entitled learner.
 *
 * SECURITY NOTE: this only models the time gate; it assumes entitlement has
 * already been decided by `resolveCourseAccess`. The watch loader must AND the
 * two together (entitled AND unlocked) before minting a playback token — a
 * dripped lesson must not play early even for a paying buyer.
 *
 *   - drip disabled, or dripDays <= 0       → unlocked now.
 *   - courseStartedAt null (not started)    → treated as starting now: a
 *                                             dripped lesson unlocks in dripDays.
 *   - now >= start + dripDays               → unlocked.
 *   - otherwise                             → locked, with whole days remaining
 *                                             (ceil, so "0.1 days left" shows 1).
 */
export function resolveLessonUnlock(opts: {
  dripEnabled: boolean;
  dripDays: number;
  courseStartedAt: number | null;
  now?: number;
}): LessonUnlock {
  const now = opts.now ?? Date.now();

  if (!opts.dripEnabled || opts.dripDays <= 0) {
    return { unlocked: true, unlocksInDays: 0, unlockAt: null };
  }

  const start = opts.courseStartedAt ?? now;
  const unlockAt = start + opts.dripDays * MS_PER_DAY;

  if (now >= unlockAt) {
    return { unlocked: true, unlocksInDays: 0, unlockAt };
  }

  const unlocksInDays = Math.max(1, Math.ceil((unlockAt - now) / MS_PER_DAY));
  return { unlocked: false, unlocksInDays, unlockAt };
}
