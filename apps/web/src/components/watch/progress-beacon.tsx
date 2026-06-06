import * as React from "react";

/**
 * The slice of the Cloudflare `StreamPlayerApi` this beacon needs. Declared
 * structurally (not imported from `@cloudflare/stream-react`) so `@btc/web`
 * stays free of that UI-only dependency — the real player API from `@btc/ui`
 * satisfies this shape, so the parent can pass its ref straight in.
 */
export type PlayerHandle = {
  readonly currentTime: number;
  readonly duration: number;
  readonly ended: boolean;
  addEventListener: (event: string, handler: EventListener) => void;
  removeEventListener: (event: string, handler: EventListener) => void;
};

const ENDPOINT = (lessonId: string) => `/api/videos/${lessonId}/progress`;

/** Throttle window: at most one position save per this many ms during play. */
const SAVE_INTERVAL_MS = 15_000;
/** Don't beacon the first couple of seconds (start-of-playback position spam). */
const MIN_POSITION_S = 2;

type ProgressBeaconProps = {
  /** The lesson whose progress we're saving (the route's `$id`). */
  lessonId: string;
  /**
   * The player's imperative API, owned by the parent watch page (the
   * UI-phase `playerRef` passthrough on StreamPlayer). We read
   * `currentTime`/`duration` from it; @btc/ui stays free of any fetch logic.
   * Typed structurally as {@link PlayerHandle} — the real `StreamPlayerApi`
   * satisfies it.
   */
  playerRef: React.RefObject<PlayerHandle | undefined>;
  /**
   * When false (viewer can't currently watch this gated lesson) the beacon
   * short-circuits — recording a position for an unwatchable lesson is
   * harmless, but there's no reason to write. Defaults to true.
   */
  enabled?: boolean;
};

/**
 * Saves a learner's position in a lesson, modeled on `ViewBeacon`.
 *
 * Write budget: throttled to ~1 save / 15s while playing, plus an immediate
 * flush on pause, ended, and tab-hide (`visibilitychange` → hidden and
 * `pagehide`). So a 40-minute lesson costs ~1 write / 15s + a flush, never
 * per-frame. Flushes use `navigator.sendBeacon` (survives page unload), with a
 * `fetch(..., { keepalive })` fallback. The server UPSERT keeps row count
 * bounded (one row per user+lesson) regardless of beacon frequency.
 */
export function ProgressBeacon({
  lessonId,
  playerRef,
  enabled = true,
}: ProgressBeaconProps) {
  // Refs (not state): the beacon never renders, so we avoid re-render churn and
  // keep the latest values available to the unmount/unload flush.
  const lastSentAt = React.useRef(0);
  const lastPosition = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) return;

    const url = ENDPOINT(lessonId);

    function snapshot(): { position: number; duration: number | null } | null {
      const player = playerRef.current;
      if (!player) return null;
      const position = Number(player.currentTime) || 0;
      const duration = Number.isFinite(player.duration)
        ? player.duration
        : null;
      return { position, duration };
    }

    function send(force: boolean) {
      const snap = snapshot();
      if (!snap) return;
      const { position, duration } = snap;
      const ended = playerRef.current?.ended === true;

      // Skip start-of-playback noise unless the lesson actually ended.
      if (!ended && position < MIN_POSITION_S) return;
      // Throttle steady-state saves; forced flushes (pause/ended/hide) bypass.
      if (!force && Date.now() - lastSentAt.current < SAVE_INTERVAL_MS) return;
      // Nothing moved since the last save — don't write a duplicate.
      if (!force && position === lastPosition.current) return;

      lastSentAt.current = Date.now();
      lastPosition.current = position;

      const payload = JSON.stringify({ position, duration });
      // sendBeacon survives unload; fall back to keepalive fetch when it's
      // unavailable or rejects (e.g. payload too large — it won't be here).
      const beacon =
        typeof navigator !== "undefined" && "sendBeacon" in navigator
          ? navigator.sendBeacon(
              url,
              new Blob([payload], { type: "application/json" }),
            )
          : false;
      if (!beacon) {
        void fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    }

    const onTimeUpdate = () => send(false);
    const onFlush = () => send(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") send(true);
    };

    // The Cloudflare player surfaces standard media events; we subscribe to the
    // imperative API once it's mounted. `addEventListener` exists on the API.
    const player = playerRef.current;
    player?.addEventListener("timeupdate", onTimeUpdate);
    player?.addEventListener("pause", onFlush);
    player?.addEventListener("ended", onFlush);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onFlush);

    return () => {
      player?.removeEventListener("timeupdate", onTimeUpdate);
      player?.removeEventListener("pause", onFlush);
      player?.removeEventListener("ended", onFlush);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onFlush);
      // Final flush on navigation away from the lesson.
      send(true);
    };
  }, [lessonId, playerRef, enabled]);

  return null;
}
