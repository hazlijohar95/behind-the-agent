import type { Video } from "@btc/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type PlaybackDecision,
  resolvePlayback,
  streamSigningConfigured,
  streamSigningMisconfigured,
} from "./playback-guard";

/**
 * Playback guard — security fix H2. The bare Cloudflare Stream `uid` plays the
 * raw file with NO entitlement check. For gated content the player src must only
 * ever be a short-lived signed token; a bare uid for gated content silently
 * bypasses the paywall.
 *
 * THE INVARIANT UNDER TEST: for any gated video lacking a usable signed token,
 * resolvePlayback must NEVER return `{ kind: "play", src: streamUid }`. It must
 * return `processing` (no uid yet) or `misconfigured`. The only `play` result
 * for gated content carries the token as src.
 *
 * Env read lazily per call:
 *   streamSigningConfigured()  → STREAM_SIGNING_KEY_ID && STREAM_SIGNING_JWK
 *   streamSigningMisconfigured() → monetizationEnabled() && !signingConfigured()
 *       (monetizationEnabled() → POLAR_ENABLED === "true" && POLAR_ACCESS_TOKEN)
 */

const STREAM_UID = "abc123streamuid";
const SIGNED_TOKEN = "eyJhbGciOiJSUzI1NiJ9.payload.sig"; // looks nothing like the uid

function video(
  overrides: Partial<Video>,
): Pick<Video, "streamUid" | "playbackPolicy" | "access"> {
  return {
    streamUid: STREAM_UID,
    playbackPolicy: "signed",
    access: "subscribers",
    ...overrides,
  };
}

function enableSigning() {
  vi.stubEnv("STREAM_SIGNING_KEY_ID", "key_123");
  vi.stubEnv("STREAM_SIGNING_JWK", "eyJrdHkiOiJSU0EifQ=="); // base64-ish, presence-only check
}

function disableSigning() {
  vi.stubEnv("STREAM_SIGNING_KEY_ID", "");
  vi.stubEnv("STREAM_SIGNING_JWK", "");
}

function enableMonetization() {
  vi.stubEnv("POLAR_ENABLED", "true");
  vi.stubEnv("POLAR_ACCESS_TOKEN", "polar_test_token");
}

function disableMonetization() {
  vi.stubEnv("POLAR_ENABLED", "false");
  vi.stubEnv("POLAR_ACCESS_TOKEN", "");
}

/** Assert the H2 invariant directly: this decision never leaks the bare uid. */
function assertNeverBareUid(d: PlaybackDecision) {
  if (d.kind === "play") {
    expect(d.src).not.toBe(STREAM_UID);
  }
}

beforeEach(() => {
  enableSigning();
  enableMonetization();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/* ───────────────────────── streamSigningConfigured ───────────────────────── */

describe("streamSigningConfigured", () => {
  it("true only when BOTH key id and jwk are set", () => {
    enableSigning();
    expect(streamSigningConfigured()).toBe(true);
  });

  it("false when the JWK is missing", () => {
    vi.stubEnv("STREAM_SIGNING_KEY_ID", "key_123");
    vi.stubEnv("STREAM_SIGNING_JWK", "");
    expect(streamSigningConfigured()).toBe(false);
  });

  it("false when the key id is missing", () => {
    vi.stubEnv("STREAM_SIGNING_KEY_ID", "");
    vi.stubEnv("STREAM_SIGNING_JWK", "eyJrdHkiOiJSU0EifQ==");
    expect(streamSigningConfigured()).toBe(false);
  });
});

/* ───────────────────────── streamSigningMisconfigured ───────────────────────── */

describe("streamSigningMisconfigured — detects the dangerous operator state", () => {
  it("TRUE when monetization is ON but signing keys are unset (the leak)", () => {
    enableMonetization();
    disableSigning();
    expect(streamSigningMisconfigured()).toBe(true);
  });

  it("false when monetization is on AND signing is configured (the safe state)", () => {
    enableMonetization();
    enableSigning();
    expect(streamSigningMisconfigured()).toBe(false);
  });

  it("false when monetization is off (nothing is gated, so no signing needed)", () => {
    disableMonetization();
    disableSigning();
    expect(streamSigningMisconfigured()).toBe(false);
  });
});

/* ───────────────────────── resolvePlayback ───────────────────────── */

describe("resolvePlayback — processing", () => {
  it("returns processing when there is no streamUid yet, regardless of gating", () => {
    const r = resolvePlayback(
      video({ streamUid: null, access: "subscribers" }),
      undefined,
    );
    expect(r.kind).toBe("processing");
  });
});

describe("resolvePlayback — free (ungated) video", () => {
  it("plays with the bare uid when no token is supplied (free content is allowed to)", () => {
    const r = resolvePlayback(
      video({ access: "free", playbackPolicy: "public" }),
      undefined,
    );
    expect(r).toEqual({ kind: "play", src: STREAM_UID });
  });

  it("prefers the token for a free video when one is supplied", () => {
    const r = resolvePlayback(
      video({ access: "free", playbackPolicy: "public" }),
      SIGNED_TOKEN,
    );
    expect(r).toEqual({ kind: "play", src: SIGNED_TOKEN });
  });
});

describe("resolvePlayback — gated video: the H2 invariant", () => {
  it("REFUSES (never bare uid) a gated video with NO token even when fully configured", () => {
    // Signing configured + policy signed, but token is undefined: the single
    // most dangerous case. Must be misconfigured(no-token), NOT play(uid).
    const r = resolvePlayback(
      video({ access: "subscribers", playbackPolicy: "signed" }),
      undefined,
    );
    expect(r.kind).toBe("misconfigured");
    if (r.kind === "misconfigured") expect(r.reason).toBe("no-token");
    assertNeverBareUid(r);
  });

  it("REFUSES with signing-disabled when monetization is on but signing keys are unset", () => {
    disableSigning();
    const r = resolvePlayback(
      video({ access: "subscribers", playbackPolicy: "signed" }),
      undefined,
    );
    expect(r.kind).toBe("misconfigured");
    if (r.kind === "misconfigured") expect(r.reason).toBe("signing-disabled");
    assertNeverBareUid(r);
  });

  it("REFUSES with policy-mismatch when the video is gated but not marked signed", () => {
    const r = resolvePlayback(
      video({ access: "purchase", playbackPolicy: "public" }),
      SIGNED_TOKEN, // even WITH a token, a public-policy gated video can't enforce it
    );
    expect(r.kind).toBe("misconfigured");
    if (r.kind === "misconfigured") expect(r.reason).toBe("policy-mismatch");
    assertNeverBareUid(r);
  });

  it("does NOT fall back to the bare uid even if a token is passed but policy is wrong", () => {
    // Guards against a refactor that does `src: token ?? streamUid` for gated.
    const r = resolvePlayback(
      video({ access: "subscribers", playbackPolicy: "public" }),
      undefined,
    );
    assertNeverBareUid(r);
    expect(r.kind).not.toBe("play");
  });

  it("PLAYS a properly gated video using the TOKEN as src (never the uid)", () => {
    const r = resolvePlayback(
      video({ access: "subscribers", playbackPolicy: "signed" }),
      SIGNED_TOKEN,
    );
    expect(r).toEqual({ kind: "play", src: SIGNED_TOKEN });
    // belt-and-suspenders: the src must not be the bare uid
    assertNeverBareUid(r);
  });

  it("treats a purchase video the same as subscribers for gating", () => {
    const r = resolvePlayback(
      video({ access: "purchase", playbackPolicy: "signed" }),
      SIGNED_TOKEN,
    );
    expect(r).toEqual({ kind: "play", src: SIGNED_TOKEN });
  });
});

describe("resolvePlayback — forceGated closes the C1 side-door", () => {
  it("REFUSES a bare uid for a FREE-access video when forceGated is true and no token", () => {
    // A free lesson-backing video on /v/$slug that backs a gated course: even
    // though its own access is "free", forceGated must stop the bare-uid play.
    const r = resolvePlayback(
      video({ access: "free", playbackPolicy: "signed" }),
      undefined,
      true,
    );
    expect(r.kind).toBe("misconfigured");
    if (r.kind === "misconfigured") expect(r.reason).toBe("no-token");
    assertNeverBareUid(r);
  });

  it("a forceGated free video with the wrong policy is policy-mismatch, not play", () => {
    const r = resolvePlayback(
      video({ access: "free", playbackPolicy: "public" }),
      SIGNED_TOKEN,
      true,
    );
    expect(r.kind).toBe("misconfigured");
    if (r.kind === "misconfigured") expect(r.reason).toBe("policy-mismatch");
    assertNeverBareUid(r);
  });

  it("a forceGated free video WITH a token and signed policy plays via the token", () => {
    const r = resolvePlayback(
      video({ access: "free", playbackPolicy: "signed" }),
      SIGNED_TOKEN,
      true,
    );
    expect(r).toEqual({ kind: "play", src: SIGNED_TOKEN });
  });

  it("forceGated=false leaves a genuinely free video playing by bare uid", () => {
    const r = resolvePlayback(
      video({ access: "free", playbackPolicy: "public" }),
      undefined,
      false,
    );
    expect(r).toEqual({ kind: "play", src: STREAM_UID });
  });
});
