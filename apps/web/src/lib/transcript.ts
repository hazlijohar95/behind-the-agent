/**
 * Video transcripts from Cloudflare Stream's AI-generated captions.
 *
 * Pipeline (driven by the Stream webhook when a video becomes `ready`):
 *
 *   1. requestTranscript(uid)            → ask Stream to generate captions (async)
 *   2. …Stream transcribes in the background (seconds-to-minutes)…
 *   3. ingestTranscript(videoId, uid)    → when ready, download the VTT, flatten
 *                                          it to plain text, and persist it on the
 *                                          video via the videos repository.
 *
 * Generation is asynchronous and Stream sends no "captions ready" webhook, so
 * step 3 is a poll: the webhook makes a short best-effort attempt inline, and
 * the same idempotent call can be retried later (e.g. by a cron drain) until it
 * lands. The stored transcript backs full-text search (the `transcript` column
 * feeds the `videos.search` tsvector) and any future "jump to spoken word" UI.
 */

import { videoRepo } from "@btc/db";
import {
  fetchCaptionVtt,
  generateCaptions,
  getCaptionStatus,
} from "@btc/stream";

/** Outcome of an ingest attempt, so a caller can decide whether to retry. */
export type TranscriptResult =
  | { status: "stored"; chars: number }
  | { status: "pending" } // captions still generating — retry later
  | { status: "empty" } // ready, but VTT had no usable text — don't retry
  | { status: "unavailable" }; // no track / fetch failed — retry later

/**
 * Ask Cloudflare Stream to generate captions for a freshly-ready video. Safe to
 * call more than once (redelivered webhook): an existing generated track is not
 * re-created. Never throws — returns false on failure so a webhook handler can
 * carry on. The transcript text is fetched separately, once generation settles.
 */
export async function requestTranscript(streamUid: string): Promise<boolean> {
  try {
    return await generateCaptions(streamUid);
  } catch (err) {
    console.error("[transcript] generate request failed:", err);
    return false;
  }
}

/**
 * Try to download + persist the transcript for a video whose captions may be
 * ready. Idempotent and side-effect-light:
 *
 *   - status not `ready`       → `pending` / `unavailable` (caller may retry)
 *   - VTT empty after parsing  → `empty` (nothing to store, do not retry)
 *   - otherwise                → store via `videoRepo.setTranscript` → `stored`
 *
 * Never throws; failures degrade to a retry-able result.
 */
export async function ingestTranscript(
  videoId: string,
  streamUid: string,
): Promise<TranscriptResult> {
  try {
    const status = await getCaptionStatus(streamUid);
    if (status === null) return { status: "unavailable" };
    if (status === "inprogress") return { status: "pending" };
    if (status === "error") return { status: "unavailable" };

    const vtt = await fetchCaptionVtt(streamUid);
    if (vtt === null) return { status: "unavailable" };

    const text = vttToText(vtt);
    if (!text) return { status: "empty" };

    await videoRepo.setTranscript(videoId, text);
    return { status: "stored", chars: text.length };
  } catch (err) {
    console.error("[transcript] ingest failed:", err);
    return { status: "unavailable" };
  }
}

const TIMESTAMP_LINE = /-->/;
const CUE_INDEX_LINE = /^\d+$/;
const BLOCK_HEADER = /^(NOTE|STYLE|REGION)\b/;
// Inline cue payload markup: <c.classname>…</c>, <v Speaker>, <00:00:01.000>, etc.
const INLINE_TAG = /<[^>]+>/g;
const NUMERIC_ENTITY = /&#(x?[0-9a-f]+);/gi;

/**
 * Flatten a WebVTT document into a plain-text transcript: drop the WEBVTT
 * header block (everything up to its terminating blank line — `Kind:`,
 * `Language:`, etc.), skip NOTE/STYLE/REGION blocks, cue identifiers and timing
 * lines, strip inline cue tags, decode VTT character escapes, and join the
 * spoken lines. Consecutive duplicate lines (common in rolling auto-captions,
 * where each cue repeats the previous line) are collapsed so the stored text —
 * and the search vector built from it — isn't bloated with repeats.
 */
export function vttToText(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const out: string[] = [];

  // The WEBVTT header runs from the first line to the first blank line; skip it
  // wholesale so header metadata never leaks into the transcript.
  let i = 0;
  if (lines[0]?.trimStart().startsWith("WEBVTT")) {
    i = 1;
    while (i < lines.length && lines[i]?.trim() !== "") i++;
  }

  for (; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line) continue;
    if (BLOCK_HEADER.test(line)) continue;
    if (TIMESTAMP_LINE.test(line)) continue;
    if (CUE_INDEX_LINE.test(line)) continue;

    const text = decodeVttEntities(line.replace(INLINE_TAG, "")).trim();
    if (!text) continue;
    if (text === out[out.length - 1]) continue; // collapse rolling repeats
    out.push(text);
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}

/** Decode the WebVTT named escapes plus stray numeric/`&apos;` entities. */
function decodeVttEntities(s: string): string {
  return s
    .replace(/&lrm;/g, "")
    .replace(/&rlm;/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(NUMERIC_ENTITY, (_m, code: string) => {
      const cp = code.startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // last: avoid double-decoding "&amp;lt;"
}
