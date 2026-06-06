/**
 * AI auto-metadata — derive a video's title, description, SEO tags, and
 * chapters from its transcript.
 *
 * Mirrors `lib/moderation.ts`: a single `generateObject` call against OpenAI via
 * the AI SDK, with everything imported lazily so the heavy SDK only loads when
 * the feature actually runs. Gated on `OPENAI_API_KEY` (read through
 * `serverEnv`); when the key is unset — or the model call fails — the helper
 * returns `null` rather than throwing, so the editor degrades to manual entry.
 *
 * The server function at the bottom is the client boundary: it requires an
 * admin, validates the transcript with zod, and hands the result back in the
 * `{ ok, error }` convention used by the other admin actions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/session";

/** One generated chapter marker: a start time in whole seconds + a short label. */
export type VideoChapter = {
  /** Chapter start, in seconds from the beginning of the video. */
  startSeconds: number;
  /** Concise chapter label (no leading timecode). */
  title: string;
};

/** The full set of editor fields the model proposes from a transcript. */
export type VideoMetadataSuggestion = {
  title: string;
  description: string;
  tags: string[];
  chapters: VideoChapter[];
};

/** Result of an AI metadata request, in the admin-action `{ ok }` convention. */
export type GenerateMetadataResult =
  | { ok: true; suggestion: VideoMetadataSuggestion }
  | { ok: false; error: string };

/**
 * Transcripts can be long; cap what we send to the model to keep the request
 * bounded (cost + latency) and within context. The opening of a talk almost
 * always establishes the topic, so a generous head slice is plenty for titling,
 * summarising, and chaptering.
 */
const MAX_TRANSCRIPT_CHARS = 24_000;

/**
 * Ask the model to propose editor metadata for a transcript. Returns `null`
 * when the feature is disabled (`OPENAI_API_KEY` unset) or the call fails, so
 * callers can fall back to manual entry without special-casing errors.
 */
export async function generateVideoMetadata(
  transcript: string,
): Promise<VideoMetadataSuggestion | null> {
  if (!serverEnv().OPENAI_API_KEY) return null;

  const text = transcript.trim().slice(0, MAX_TRANSCRIPT_CHARS);
  if (!text) return null;

  try {
    const { generateObject } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        title: z
          .string()
          .max(120)
          .describe(
            "A concise, compelling video title. Plain text, no surrounding quotes.",
          ),
        description: z
          .string()
          .max(1_500)
          .describe(
            "A 2-4 sentence summary of what the video covers, written for viewers.",
          ),
        tags: z
          .array(z.string().max(40))
          .max(12)
          .describe(
            "Lowercase, single- or two-word SEO keywords. No '#', no duplicates.",
          ),
        chapters: z
          .array(
            z.object({
              startSeconds: z
                .number()
                .int()
                .nonnegative()
                .describe("Chapter start in whole seconds from the start."),
              title: z
                .string()
                .max(80)
                .describe("Short chapter label, no leading timecode."),
            }),
          )
          .max(20)
          .describe(
            "Ordered chapters covering the main sections. Omit if the transcript carries no timing cues.",
          ),
      }),
      system:
        "You write metadata for a single-publisher video platform. From the supplied transcript, produce an accurate, non-clickbait title, a faithful viewer-facing description, focused SEO tags, and ordered chapter markers. Never invent facts that are not supported by the transcript.",
      prompt: text,
    });

    // Normalise the model output to the editor's expectations: trim, lowercase
    // and de-duplicate tags, and keep chapters in chronological order.
    const tags = [
      ...new Set(
        object.tags
          .map((t) => t.trim().toLowerCase().replace(/^#+/, ""))
          .filter(Boolean),
      ),
    ];
    const chapters = [...object.chapters]
      .filter((c) => c.title.trim().length > 0)
      .sort((a, b) => a.startSeconds - b.startSeconds)
      .map((c) => ({ startSeconds: c.startSeconds, title: c.title.trim() }));

    return {
      title: object.title.trim(),
      description: object.description.trim(),
      tags,
      chapters,
    };
  } catch (err) {
    console.error("[ai-metadata] generation failed:", err);
    return null;
  }
}

/* ───────────────────────── Server function ───────────────────────── */

const generateMetadataInput = z.object({
  transcript: z.string().min(1).max(200_000),
});

/**
 * Admin-only action: generate metadata suggestions from a transcript. Validates
 * input at the boundary, then runs the model. Failures (feature disabled, empty
 * model output, or a thrown call) collapse to a clear `{ ok: false }` so the
 * editor can surface a toast instead of crashing.
 */
export const generateMetadataAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => generateMetadataInput.parse(input))
  .handler(async ({ data }): Promise<GenerateMetadataResult> => {
    await requireAdmin();

    if (!serverEnv().OPENAI_API_KEY) {
      return {
        ok: false,
        error: "AI metadata is unavailable — OPENAI_API_KEY is not configured.",
      };
    }

    const suggestion = await generateVideoMetadata(data.transcript);
    if (!suggestion) {
      return {
        ok: false,
        error: "Could not generate metadata from this transcript.",
      };
    }

    return { ok: true, suggestion };
  });
