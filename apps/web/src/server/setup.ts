/**
 * First-run setup wizard — server logic.
 *
 * Powers the in-app `/admin/setup` checklist: it inspects the environment
 * (Stream, Cloudflare, Polar, signing keys, Supabase auth callback) and the
 * catalog to report what is and isn't configured yet, and it loads / clears the
 * demo content so an operator can kick the tyres without leaving the app.
 *
 * SECURITY: this never returns a secret value. Each integration reports only a
 * boolean `configured` plus a copy-paste-ready `setHint` describing HOW to set
 * the variable (the env var name + the command), never its current contents.
 * The two values it does surface verbatim are public by definition: the Stream
 * customer code (already inlined into the browser bundle) and the Supabase auth
 * callback URL (derived from the public app URL). Secrets are read through the
 * typed, zod-validated `serverEnv()` accessor — never ad-hoc `process.env` —
 * and lazily per request, matching the rest of the server code.
 */

import { categoryRepo, videoRepo } from "@btc/db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { monetizationEnabled } from "@/lib/entitlements";
import { appUrl, serverEnv, supabaseUrl } from "@/lib/env";
import { streamSigningConfigured } from "@/lib/playback-guard";
import { requireAdmin } from "@/lib/session";
import {
  DEMO_CATEGORIES,
  DEMO_VIDEO_BODY,
  GENERIC_DEMO_VIDEOS,
  VIDEOS_BY_DEMO_CATEGORY,
} from "@/lib/setup-demo";

/* ───────────────────────── Status model ───────────────────────── */

/** Stable identifiers for each checklist item (used as React keys + actions). */
export type SetupStepId =
  | "stream-api"
  | "stream-customer-code"
  | "stream-signing"
  | "polar"
  | "supabase-callback"
  | "openai"
  | "email";

/**
 * One checklist row. `configured` is the only state the UI gates on; everything
 * else is presentational. `value` is ONLY ever set for the two public values
 * (customer code, callback URL) — it is never a secret.
 */
export type SetupStep = {
  id: SetupStepId;
  title: string;
  description: string;
  /** Whether this integration is wired up (its required env var(s) are set). */
  configured: boolean;
  /** Optional — required for core monetization, otherwise the feature is just off. */
  required: boolean;
  /** Names of the env var(s) this step controls. */
  envVars: string[];
  /** How to set it (env var name + where) — safe to show, contains no secret. */
  setHint: string;
  /** A PUBLIC value to copy (callback URL / customer code). Never a secret. */
  value?: string;
  /** Loud warning when a misconfiguration actively breaks the platform (H2). */
  warning?: string;
};

export type SetupStatus = {
  steps: SetupStep[];
  /** True once every *required* step is configured. */
  ready: boolean;
  /** Whether paid monetization (Polar) is switched on. */
  monetizationEnabled: boolean;
  /** Number of videos in the catalog (drives the "first upload" step). */
  videoCount: number;
  /** Whether the seeded demo categories are present (drives load/clear). */
  hasDemoContent: boolean;
  /** The public Supabase auth redirect/callback URL to register. */
  authCallbackUrl: string;
};

/** Whether a non-empty value is present for the given server secret. */
function has(value: string | undefined): boolean {
  return typeof value === "string" && value.length > 0;
}

/**
 * Compute the full setup status. Server-only (reads `serverEnv()` + repos).
 * Pure aside from the env/db reads — no mutation, safe to call on every load.
 */
async function computeSetupStatus(): Promise<SetupStatus> {
  const env = serverEnv();
  const monetization = monetizationEnabled();

  // Public values — safe to surface verbatim.
  const customerCode =
    import.meta.env.VITE_STREAM_CUSTOMER_CODE ??
    process.env.VITE_STREAM_CUSTOMER_CODE ??
    "";
  const authCallbackUrl = `${appUrl()}/auth/callback`;

  const signingConfigured = streamSigningConfigured();

  const steps: SetupStep[] = [
    {
      id: "stream-api",
      title: "Cloudflare Stream API token",
      description:
        "Lets the server provision uploads and manage videos on Cloudflare Stream.",
      configured: has(env.CLOUDFLARE_STREAM_API_TOKEN),
      required: true,
      envVars: ["CLOUDFLARE_STREAM_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
      setHint:
        "wrangler secret put CLOUDFLARE_STREAM_API_TOKEN  (and CLOUDFLARE_ACCOUNT_ID)",
    },
    {
      id: "stream-customer-code",
      title: "Stream customer code",
      description:
        "The public customer-<code> subdomain used to build thumbnail and player URLs.",
      configured: has(customerCode || undefined),
      required: true,
      envVars: ["VITE_STREAM_CUSTOMER_CODE"],
      setHint:
        "Add VITE_STREAM_CUSTOMER_CODE to .env (it's public, inlined at build).",
      value: customerCode || undefined,
    },
    {
      id: "stream-signing",
      title: "Signed-playback keys",
      description:
        "Required to play gated (subscriber / purchase) videos securely. Without these, gated videos refuse to play.",
      configured: signingConfigured,
      // Only strictly required once monetization is on; harmless otherwise.
      required: monetization,
      envVars: ["STREAM_SIGNING_KEY_ID", "STREAM_SIGNING_JWK"],
      setHint:
        "Run `bun run --cwd apps/web stream-setup`, then `wrangler secret put STREAM_SIGNING_KEY_ID` and `STREAM_SIGNING_JWK`.",
      warning:
        monetization && !signingConfigured
          ? "Monetization is ON but signing keys are unset — every gated video will show a misconfiguration state until you set these."
          : undefined,
    },
    {
      id: "polar",
      title: "Polar access token",
      description:
        "Enables paid subscriptions and one-time purchases. Leave unset to run a fully free platform.",
      configured: has(env.POLAR_ACCESS_TOKEN),
      required: false,
      envVars: ["POLAR_ACCESS_TOKEN", "POLAR_ENABLED", "POLAR_WEBHOOK_SECRET"],
      setHint:
        "Set POLAR_ENABLED=true, then `wrangler secret put POLAR_ACCESS_TOKEN` (and POLAR_WEBHOOK_SECRET).",
    },
    {
      id: "supabase-callback",
      title: "Supabase auth callback URL",
      description:
        "Register this redirect URL in Supabase → Authentication → URL Configuration so sign-in returns to your app.",
      // Configured-ish whenever the project URL is known; the URL itself is the action.
      configured: has(supabaseUrl() || undefined),
      required: true,
      envVars: ["VITE_APP_URL", "VITE_SUPABASE_URL"],
      setHint:
        "Add this URL to Supabase Auth → URL Configuration → Redirect URLs.",
      value: authCallbackUrl,
    },
    {
      id: "openai",
      title: "OpenAI key (AI moderation)",
      description:
        "Optional — powers automatic comment moderation. Leave unset to moderate manually.",
      configured: has(env.OPENAI_API_KEY),
      required: false,
      envVars: ["OPENAI_API_KEY", "AI_MODERATION_ENABLED"],
      setHint:
        "`wrangler secret put OPENAI_API_KEY`, then enable AI moderation in Settings.",
    },
    {
      id: "email",
      title: "Transactional email (Resend)",
      description:
        "Optional — sends magic links and notifications. Leave unset to skip email.",
      configured: has(env.RESEND_API_KEY),
      required: false,
      envVars: ["RESEND_API_KEY", "EMAIL_FROM"],
      setHint: "`wrangler secret put RESEND_API_KEY` and set EMAIL_FROM.",
    },
  ];

  const [adminVideos, categories] = await Promise.all([
    videoRepo.listAdminVideos({ limit: 1 }),
    categoryRepo.listCategories(),
  ]);

  // Demo content is detectable by the seeded category names being present.
  const demoNames = new Set(DEMO_CATEGORIES.map((c) => c.name));
  const hasDemoContent = categories.some((c) => demoNames.has(c.name));

  const ready = steps.every((s) => !s.required || s.configured);

  return {
    steps,
    ready,
    monetizationEnabled: monetization,
    videoCount: adminVideos.total,
    hasDemoContent,
    authCallbackUrl,
  };
}

/** Admin-only loader for the setup wizard. */
export const loadSetupStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireAdmin();
    return computeSetupStatus();
  },
);

/* ───────────────────────── Demo content ───────────────────────── */

/**
 * Load the demo catalog (categories + published videos) so a fresh install has
 * something to look at. Idempotent — mirrors `scripts/seed.ts`: it skips
 * categories / videos that already exist, so re-running never duplicates. Uses
 * the repositories only (no raw table access).
 */
export const loadDemoContentAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({}).parse(input ?? {}))
  .handler(async () => {
    await requireAdmin();

    // 1. Categories (skip any already present by name).
    const existing = await categoryRepo.listCategories();
    const byName = new Map(existing.map((c) => [c.name, c]));
    for (const def of DEMO_CATEGORIES) {
      if (!byName.has(def.name)) {
        const created = await categoryRepo.createCategory(def);
        byName.set(created.name, created);
      }
    }

    // 2. Videos — only seed when the catalog is empty, so this stays idempotent
    //    and never touches a real operator's content.
    const published = await videoRepo.listPublished({ limit: 1 });
    if (published.total === 0) {
      for (const category of byName.values()) {
        const defs =
          VIDEOS_BY_DEMO_CATEGORY[category.name] ?? GENERIC_DEMO_VIDEOS;
        for (const def of defs) {
          const video = await videoRepo.createVideo({
            title: def.title,
            description: DEMO_VIDEO_BODY,
            categoryId: category.id,
            access: def.access,
            streamUid: def.streamUid,
            playbackPolicy: def.access === "free" ? "public" : "signed",
          });
          await videoRepo.markVideoReady(video.id, {
            duration: def.minutes * 60,
            aspectRatio: "16:9",
          });
          await videoRepo.publishVideo(video.id);
        }
      }
    }

    return { ok: true };
  });

/**
 * Remove the demo content. Deletes every video belonging to a seeded demo
 * category, then the demo categories themselves. Scoped strictly to the seeded
 * demo category names so it never deletes an operator's own categories/videos.
 * Repositories only — no raw table access.
 */
export const clearDemoContentAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({}).parse(input ?? {}))
  .handler(async () => {
    await requireAdmin();

    const demoNames = new Set(DEMO_CATEGORIES.map((c) => c.name));
    const categories = await categoryRepo.listCategories();
    const demoCategories = categories.filter((c) => demoNames.has(c.name));
    const demoCategoryIds = new Set(demoCategories.map((c) => c.id));

    // Page through admin videos and delete the ones in a demo category.
    let offset = 0;
    for (;;) {
      const page = await videoRepo.listAdminVideos({ limit: 100, offset });
      for (const v of page.items) {
        if (v.categoryId && demoCategoryIds.has(v.categoryId)) {
          await videoRepo.deleteVideo(v.id);
        }
      }
      if (!page.hasMore) break;
      offset = page.nextOffset;
    }

    for (const category of demoCategories) {
      await categoryRepo.deleteCategory(category.id);
    }

    return { ok: true };
  });
