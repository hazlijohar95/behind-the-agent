import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
import * as React from "react";
import { cn } from "#lib/utils";

export const SEEK_EVENT = "behindthecode:seek";

/** Dispatch a seek to the active player (used by transcript + MDX timestamps). */
export function dispatchSeek(seconds: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SEEK_EVENT, { detail: { seconds } }));
}

/**
 * The minimal slice of the Cloudflare `StreamPlayerApi` exposed via `playerRef`.
 * Declared structurally so consumers (e.g. the web app's progress beacon) can
 * read playback state without taking a dependency on `@cloudflare/stream-react`.
 * The real `StreamPlayerApi` is a superset and satisfies this.
 */
export type StreamPlayerHandle = {
  currentTime: number;
  readonly duration: number;
  readonly ended: boolean;
  addEventListener: (event: string, handler: EventListener) => void;
  removeEventListener: (event: string, handler: EventListener) => void;
};

export type StreamPlayerProps = {
  /** Cloudflare Stream video uid, or a signed token for gated playback. */
  src: string;
  poster?: string;
  primaryColor?: string;
  startTime?: number;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  /**
   * Optional passthrough of the player's imperative API. When provided, the
   * player writes its `StreamPlayerApi` here (it's used directly as the
   * Cloudflare `streamRef`, so the consumer holds the SAME instance the player
   * uses) — e.g. the learner-progress beacon reads `currentTime`/`duration` and
   * subscribes to media events. Typed as the structural {@link StreamPlayerHandle}
   * so callers needn't depend on `@cloudflare/stream-react`.
   */
  playerRef?: React.MutableRefObject<StreamPlayerHandle | undefined>;
};

export function StreamPlayer({
  src,
  poster,
  primaryColor = "#ffffff",
  startTime,
  autoPlay,
  muted,
  className,
  playerRef,
}: StreamPlayerProps) {
  const internalApi = React.useRef<StreamPlayerApi | undefined>(undefined);
  // Single source of truth for the imperative API: the caller's ref when given,
  // otherwise our own. Both the seek handler and any external consumer (beacon)
  // read the same object. The Cloudflare `Stream` only ever writes a full
  // `StreamPlayerApi` into it, and `StreamPlayerHandle` is a subset of that, so
  // the cast at `streamRef` is sound (ref `current` is invariant in TS, but the
  // runtime value is always a complete StreamPlayerApi).
  const api = (playerRef ?? internalApi) as React.MutableRefObject<
    StreamPlayerApi | undefined
  >;
  const wrap = React.useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only SEEK listener; api and wrap are stable refs
  React.useEffect(() => {
    function onSeek(e: Event) {
      const detail = (e as CustomEvent<{ seconds: number }>).detail;
      const player = api.current;
      if (!player || !detail) return;
      player.currentTime = detail.seconds;
      void player.play?.();
      wrap.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.addEventListener(SEEK_EVENT, onSeek);
    return () => window.removeEventListener(SEEK_EVENT, onSeek);
  }, []);

  return (
    <div
      ref={wrap}
      className={cn(
        "aspect-video w-full overflow-hidden rounded-2xl",
        className,
      )}
    >
      <Stream
        streamRef={api}
        src={src}
        controls
        poster={poster}
        primaryColor={primaryColor}
        startTime={startTime}
        autoplay={autoPlay}
        muted={muted}
        responsive
      />
    </div>
  );
}
