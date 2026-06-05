import { Stream, type StreamPlayerApi } from "@cloudflare/stream-react";
import * as React from "react";
import { cn } from "#lib/utils";

export const SEEK_EVENT = "behindthecode:seek";

/** Dispatch a seek to the active player (used by transcript + MDX timestamps). */
export function dispatchSeek(seconds: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SEEK_EVENT, { detail: { seconds } }));
}

export type StreamPlayerProps = {
  /** Cloudflare Stream video uid, or a signed token for gated playback. */
  src: string;
  poster?: string;
  primaryColor?: string;
  startTime?: number;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
};

export function StreamPlayer({
  src,
  poster,
  primaryColor = "#ffffff",
  startTime,
  autoPlay,
  muted,
  className,
}: StreamPlayerProps) {
  const api = React.useRef<StreamPlayerApi | undefined>(undefined);
  const wrap = React.useRef<HTMLDivElement>(null);

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
