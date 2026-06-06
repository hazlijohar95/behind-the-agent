import {
  StreamPlayer,
  type StreamPlayerHandle,
} from "@btc/ui/components/stream-player";
import * as React from "react";
import { ProgressBeacon } from "@/components/watch/progress-beacon";

/**
 * Client player for a course lesson: renders the Cloudflare player and mounts
 * the learner-progress beacon against the SAME imperative player API.
 *
 * The parent (lesson watch route) has already decided entitlement + drip and
 * minted a signed `src` (token for gated lessons, bare uid only for genuinely
 * free ones — same H2/C1 invariant as the standalone watch page). This
 * component never sees access facts beyond `enabled`; it only wires the beacon.
 */
export function LessonPlayer({
  src,
  poster,
  lessonId,
  startTime,
  enabled = true,
}: {
  src: string;
  poster?: string;
  lessonId: string;
  startTime?: number;
  /** False when the viewer can't currently watch — beacon stays dormant. */
  enabled?: boolean;
}) {
  const playerRef = React.useRef<StreamPlayerHandle | undefined>(undefined);

  return (
    <>
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <StreamPlayer
          className="size-full"
          src={src}
          poster={poster}
          startTime={startTime}
          playerRef={playerRef}
        />
      </div>
      <ProgressBeacon
        lessonId={lessonId}
        playerRef={playerRef}
        enabled={enabled}
      />
    </>
  );
}
