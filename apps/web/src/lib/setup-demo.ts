/**
 * Demo content definitions for the first-run setup wizard.
 *
 * Extracted as plain data so the in-app "load demo content" action
 * (`server/setup.ts`) and the standalone `scripts/seed.ts` describe the same
 * catalog. This module is pure data + types — no IO, no env, no secrets — so it
 * is safe to import from either a server function or a CLI script.
 */

import type { AccessLevel } from "@btc/db";

/**
 * A Cloudflare Stream sample video uid. Demo videos point at it so the player
 * has something to play without a real upload. Swap in a uid from your own
 * Stream account if this public sample stops resolving.
 */
export const DEMO_STREAM_UID = "6b9e68b07dfee8cc2d116e4c51d6a957";

/** Body copy shared by every demo video (Markdown). */
export const DEMO_VIDEO_BODY = `In this video, we'll walk through how we approached the problem, the trade-offs we considered, and how the final implementation came together.

## Introduction

We start by setting up the project and wiring the core pieces together. The goal is to keep the surface area small while leaving room to grow.

## Wrapping up

With the foundations in place, the rest is iteration — ship something small, measure, and refine.`;

export type DemoVideo = {
  title: string;
  minutes: number;
  access: AccessLevel;
  /** Stream uid to attach (defaults to the shared sample below). */
  streamUid: string;
};

function video(title: string, minutes: number, access: AccessLevel): DemoVideo {
  return { title, minutes, access, streamUid: DEMO_STREAM_UID };
}

/** The demo categories seeded by both the wizard action and the seed script. */
export const DEMO_CATEGORIES: { name: string; description: string }[] = [
  { name: "Product", description: "Launches, demos, and walkthroughs." },
  { name: "Engineering", description: "Deep dives and technical talks." },
  { name: "Culture", description: "Behind the scenes with the team." },
  { name: "Tutorials", description: "Step-by-step guides." },
];

/** Demo videos keyed by category name (matches {@link DEMO_CATEGORIES}). */
export const VIDEOS_BY_DEMO_CATEGORY: Record<string, DemoVideo[]> = {
  Product: [
    video("Launching our new dashboard", 16, "free"),
    video("Designing the pricing page", 12, "free"),
    video("A walkthrough of the admin panel", 22, "subscribers"),
    video("Shipping dark mode", 14, "free"),
    video("Building the onboarding flow", 19, "purchase"),
  ],
  Engineering: [
    video("Edge-rendered dashboards", 16, "free"),
    video("Webhooks that never drop", 24, "subscribers"),
    video("Streaming server components", 15, "free"),
    video("Scaling Postgres to a million rows", 28, "purchase"),
    video("Type-safe APIs end to end", 21, "free"),
  ],
  Culture: [
    video("Behind the scenes with the team", 18, "free"),
    video("How we run remote standups", 11, "free"),
    video("Our design review process", 17, "subscribers"),
    video("A day in the life of an engineer", 13, "free"),
    video("How we hire", 20, "purchase"),
  ],
  Tutorials: [
    video("CSV import using the Vercel AI SDK", 15, "free"),
    video("Native navigation in React", 16, "free"),
    video("Building a command menu", 22, "subscribers"),
    video("Auth without the headaches", 24, "free"),
    video("Background jobs with Trigger.dev", 33, "purchase"),
  ],
};

/** Fallback set for any category without a bespoke list above. */
export const GENERIC_DEMO_VIDEOS: DemoVideo[] = [
  video("Getting started", 12, "free"),
  video("Going deeper", 18, "free"),
  video("Advanced techniques", 24, "subscribers"),
  video("Putting it together", 16, "free"),
  video("Production checklist", 21, "purchase"),
];
