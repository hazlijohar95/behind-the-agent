/**
 * Playback gating guard (security fix H2).
 *
 * A *gated* video (access !== "free") is only safe to play through a
 * short-lived signed token. The bare Cloudflare Stream `uid` plays the raw
 * video with no entitlement check, so emitting it for gated content silently
 * bypasses the paywall. This module is the single decision point that keeps a
 * bare `uid` from ever reaching the player for gated content.
 *
 * It also reports the operator misconfiguration that makes the leak possible:
 * monetization is switched on but the Stream signing keys are unset, so
 * `signToken` can only ever return null. We surface that loudly (a visible
 * "misconfigured" player state) rather than degrading to insecure playback.
 *
 * Secrets are read lazily (per call), never at module top-level: the Workers
 * runtime only populates `process.env` per-request, mirroring
 * `signingConfig()` in `@btc/stream` and `monetizationEnabled()` in
 * `lib/entitlements`.
 */

import type { Video } from "@btc/db";
import { monetizationEnabled } from "./entitlements";

/**
 * Whether Stream signed-URL playback is configured. Mirrors the check in
 * `signingConfig()` (packages/stream/src/client.ts) using the same env vars so
 * the app can reason about signing without importing server-only internals.
 * Both keys must be present for `signToken` to produce a token.
 */
export function streamSigningConfigured(): boolean {
  return (
    Boolean(process.env.STREAM_SIGNING_KEY_ID) &&
    Boolean(process.env.STREAM_SIGNING_JWK)
  );
}

/**
 * The dangerous operator state: monetization is on (so videos can be gated and
 * are expected to require a signed token) but the Stream signing keys are
 * unset, so every gated video would otherwise fall back to a bare, unprotected
 * `uid`. When this is true, gated playback MUST be refused, not degraded.
 */
export function streamSigningMisconfigured(): boolean {
  return monetizationEnabled() && !streamSigningConfigured();
}

/**
 * What the player area should render for an *allowed* viewer. The unauthorized
 * (paywall) case is decided earlier by `resolveWatchAccess` and handled by the
 * caller — this only covers viewers who are permitted to watch.
 *
 *   processing    — no `streamUid` yet (still uploading/encoding).
 *   misconfigured — gated video that cannot be played securely (no signed
 *                   token available); refuse rather than leak a bare uid.
 *   play          — safe to render the player with `src`.
 */
export type PlaybackDecision =
  | { kind: "processing" }
  | { kind: "misconfigured"; reason: PlaybackMisconfigReason }
  | { kind: "play"; src: string };

/**
 * Why gated playback was refused. Distinguishes an operator/config fault
 * (`signing-disabled`, `policy-mismatch`) so the UI can show an honest message
 * and logs can pinpoint the cause.
 *
 *   signing-disabled — monetization on but STREAM_SIGNING_* unset, so no token
 *                      could ever be minted for this (or any) gated video.
 *   policy-mismatch  — the video isn't marked `playbackPolicy === "signed"`,
 *                      so Stream wouldn't enforce the token even if we had one.
 *   no-token         — signing looks configured yet no token was produced
 *                      (e.g. a transient signing failure); still refuse.
 */
export type PlaybackMisconfigReason =
  | "signing-disabled"
  | "policy-mismatch"
  | "no-token";

/**
 * Decide what to render for a viewer who is allowed to watch `video`.
 *
 * SECURITY INVARIANT: for a gated video the returned `play` `src` is ONLY ever
 * the signed `token`. A bare `streamUid` is returned as `src` exclusively for
 * ungated (free) videos. Any gated video lacking a usable signed token resolves
 * to `misconfigured`, never `play`.
 *
 * A video is "gated" when its own `access !== "free"` OR `forceGated` is true.
 * `forceGated` closes the C1 side-door: a video whose own access is `free` but
 * which backs a *gated course's* published lesson must NOT play by bare uid on
 * the standalone `/v/$slug` page. The caller (the watch loader) computes this
 * from `lessonRepo.listPublishedLessonCoursesByVideo` and passes it in, so even
 * the standalone page refuses a bare uid for course-gated content.
 *
 * Pure: no IO. The caller resolves `token` (via `signToken`) and passes it in.
 */
export function resolvePlayback(
  video: Pick<Video, "streamUid" | "playbackPolicy" | "access">,
  token: string | undefined,
  forceGated = false,
): PlaybackDecision {
  if (!video.streamUid) return { kind: "processing" };

  const gated = forceGated || video.access !== "free";

  if (!gated) {
    // Free content: a bare uid is fine, but still prefer a token if we have one.
    return { kind: "play", src: token ?? video.streamUid };
  }

  // Gated from here on — a bare uid would bypass the paywall, so it is never
  // emitted as `src`. Refuse with the most specific reason available.
  if (video.playbackPolicy !== "signed") {
    return { kind: "misconfigured", reason: "policy-mismatch" };
  }
  if (!streamSigningConfigured()) {
    return { kind: "misconfigured", reason: "signing-disabled" };
  }
  if (!token) {
    return { kind: "misconfigured", reason: "no-token" };
  }

  return { kind: "play", src: token };
}
