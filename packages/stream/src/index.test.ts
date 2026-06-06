import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken, verifyWebhook } from "./index";

/**
 * Cloudflare Stream cryptographic operations.
 *
 *  - verifyWebhook: HMAC-SHA256 (hex) over `${time}.${rawBody}`, with a replay
 *    window. A forged or replayed webhook must be REJECTED — these handlers
 *    mutate billing/video state, so a bypass is a real exploit.
 *  - signToken: RS256 JWT for gated playback; returns null when signing isn't
 *    configured. We sign with a real RSA key generated in-test (no checked-in
 *    secrets) and assert the JWT shape + the null path.
 *
 * Both read env lazily per call. verifyWebhook's secret is passed as an arg, so
 * it needs no env. signToken reads STREAM_SIGNING_KEY_ID / STREAM_SIGNING_JWK.
 */

const SECRET = "whsec_test_secret_value";

/** Produce a real, valid Webhook-Signature header for body+secret at `timeSec`. */
async function makeSignatureHeader(
  rawBody: string,
  secret: string,
  timeSec: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timeSec}.${rawBody}`),
  );
  const hex = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `time=${timeSec},sig1=${hex}`;
}

const NOW_MS = 1_700_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);

describe("verifyWebhook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ACCEPTS a correctly signed, fresh webhook", async () => {
    const body = '{"uid":"vid_1","status":"ready"}';
    const header = await makeSignatureHeader(body, SECRET, NOW_S);
    await expect(verifyWebhook(body, header, SECRET)).resolves.toBe(true);
  });

  it("REJECTS a tampered signature (sig1 flipped) — the core forgery case", async () => {
    const body = '{"uid":"vid_1"}';
    const header = await makeSignatureHeader(body, SECRET, NOW_S);
    // Flip the last hex nibble of sig1 to a different value.
    const last = header.endsWith("0") ? "1" : "0";
    const forged = header.slice(0, -1) + last;
    await expect(verifyWebhook(body, forged, SECRET)).resolves.toBe(false);
  });

  it("REJECTS when the body was tampered after signing", async () => {
    const body = '{"uid":"vid_1","status":"ready"}';
    const header = await makeSignatureHeader(body, SECRET, NOW_S);
    const tamperedBody = '{"uid":"vid_1","status":"errored"}';
    await expect(verifyWebhook(tamperedBody, header, SECRET)).resolves.toBe(
      false,
    );
  });

  it("REJECTS a signature made with a different secret", async () => {
    const body = '{"uid":"vid_1"}';
    const header = await makeSignatureHeader(body, "the_wrong_secret", NOW_S);
    await expect(verifyWebhook(body, header, SECRET)).resolves.toBe(false);
  });

  it("REJECTS a missing signature header", async () => {
    await expect(verifyWebhook("{}", null, SECRET)).resolves.toBe(false);
  });

  it("REJECTS when the verifying secret is empty", async () => {
    const body = "{}";
    const header = await makeSignatureHeader(body, SECRET, NOW_S);
    await expect(verifyWebhook(body, header, "")).resolves.toBe(false);
  });

  it("REJECTS a malformed header missing the sig1 field", async () => {
    await expect(verifyWebhook("{}", `time=${NOW_S}`, SECRET)).resolves.toBe(
      false,
    );
  });

  it("REJECTS a malformed header missing the time field", async () => {
    await expect(verifyWebhook("{}", "sig1=deadbeef", SECRET)).resolves.toBe(
      false,
    );
  });

  it("REJECTS a stale webhook outside the replay tolerance", async () => {
    const body = '{"uid":"vid_1"}';
    // Signed 10 minutes ago; default tolerance is 5 minutes → replay rejected
    // even though the HMAC itself is perfectly valid.
    const staleTime = NOW_S - 600;
    const header = await makeSignatureHeader(body, SECRET, staleTime);
    await expect(verifyWebhook(body, header, SECRET)).resolves.toBe(false);
  });

  it("REJECTS a webhook timestamped too far in the future", async () => {
    const body = '{"uid":"vid_1"}';
    const futureTime = NOW_S + 600;
    const header = await makeSignatureHeader(body, SECRET, futureTime);
    await expect(verifyWebhook(body, header, SECRET)).resolves.toBe(false);
  });

  it("ACCEPTS a slightly stale webhook still inside tolerance", async () => {
    const body = '{"uid":"vid_1"}';
    const header = await makeSignatureHeader(body, SECRET, NOW_S - 60);
    await expect(verifyWebhook(body, header, SECRET)).resolves.toBe(true);
  });

  it("REJECTS a non-numeric time field (NaN age must not pass the window check)", async () => {
    // age = now - NaN = NaN; the guard requires Number.isFinite(age).
    await expect(
      verifyWebhook("{}", "time=notanumber,sig1=deadbeef", SECRET),
    ).resolves.toBe(false);
  });

  it("REJECTS a valid-secret signature whose sig1 length differs (constant-time length guard)", async () => {
    // timingSafeEqual returns false immediately when lengths differ. A truncated
    // sig1 (odd length, not 64 hex chars) must be rejected, never coerced to a
    // match.
    const body = '{"uid":"vid_1"}';
    const header = await makeSignatureHeader(body, SECRET, NOW_S);
    const truncated = header.slice(0, -2); // drop two hex chars from sig1
    await expect(verifyWebhook(body, truncated, SECRET)).resolves.toBe(false);
  });

  it("uses a constant-time comparison (rejects a same-length wrong sig)", async () => {
    // A wrong signature of the CORRECT length exercises the XOR-accumulating
    // compare path (not the fast length mismatch). It must still be rejected.
    const body = '{"uid":"vid_1"}';
    const header = await makeSignatureHeader(body, SECRET, NOW_S);
    const sig1 = header.split("sig1=")[1] ?? "";
    expect(sig1).toHaveLength(64); // sanity: hex SHA-256
    const wrongSameLen = "0".repeat(64);
    await expect(
      verifyWebhook(body, `time=${NOW_S},sig1=${wrongSameLen}`, SECRET),
    ).resolves.toBe(false);
  });
});

/* ───────────────────────── signToken (RS256) ───────────────────────── */

describe("signToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when signing is not configured (no env set)", async () => {
    vi.stubEnv("STREAM_SIGNING_KEY_ID", "");
    vi.stubEnv("STREAM_SIGNING_JWK", "");
    await expect(signToken("vid_1")).resolves.toBeNull();
  });

  it("signs a 3-part RS256 JWT binding the uid as sub, with exp/nbf, when configured", async () => {
    // Generate a throwaway RSA key pair, export the private key as JWK, and feed
    // it to signingConfig() exactly the way production does (base64(JSON)).
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const encodedJwk = btoa(JSON.stringify(jwk));
    vi.stubEnv("STREAM_SIGNING_KEY_ID", "key_under_test");
    vi.stubEnv("STREAM_SIGNING_JWK", encodedJwk);

    const token = await signToken("vid_42", { expiresInSeconds: 3600 });
    expect(token).not.toBeNull();
    const jwt = token as string;

    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);

    const decode = (seg: string) =>
      JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(
            atob(seg.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        ),
      );
    const header = decode(parts[0] as string);
    const payload = decode(parts[1] as string);

    expect(header.alg).toBe("RS256");
    expect(header.kid).toBe("key_under_test");
    // The token must be scoped to THIS video — a token good for any uid would
    // let one purchase unlock every gated video.
    expect(payload.sub).toBe("vid_42");
    expect(payload.exp).toBeGreaterThan(payload.nbf);

    // The signature must actually verify against the matching public key.
    const data = `${parts[0]}.${parts[1]}`;
    const sig = Uint8Array.from(
      atob((parts[2] as string).replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const ok = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      pair.publicKey,
      sig,
      new TextEncoder().encode(data),
    );
    expect(ok).toBe(true);
  });
});
