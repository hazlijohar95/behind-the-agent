import { z } from "zod";

/* ───────────────────────── Video ───────────────────────── */

export const processingStatuses = [
  "uploading",
  "processing",
  "ready",
  "errored",
] as const;
export const publishStatuses = ["draft", "scheduled", "published"] as const;
export const accessLevels = ["free", "subscribers", "purchase"] as const;
export const visibilities = ["public", "unlisted"] as const;
export const playbackPolicies = ["public", "signed"] as const;

export type ProcessingStatus = (typeof processingStatuses)[number];
export type PublishStatus = (typeof publishStatuses)[number];
export type AccessLevel = (typeof accessLevels)[number];
export type Visibility = (typeof visibilities)[number];
export type PlaybackPolicy = (typeof playbackPolicies)[number];

export const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().default(""),
  processingStatus: z.enum(processingStatuses).default("uploading"),
  publishStatus: z.enum(publishStatuses).default("draft"),
  // Cloudflare Stream uid — one stable id for playback, thumbnails, signing.
  streamUid: z.string().nullable().default(null),
  playbackPolicy: z.enum(playbackPolicies).default("public"),
  duration: z.number().nullable().default(null),
  aspectRatio: z.string().nullable().default(null),
  thumbnailTime: z.number().nullable().default(null),
  customPosterUrl: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  access: z.enum(accessLevels).default("free"),
  requiredPlanIds: z.array(z.string()).default([]),
  polarProductId: z.string().nullable().default(null),
  priceAmount: z.number().nullable().default(null),
  visibility: z.enum(visibilities).default("public"),
  createdAt: z.number(),
  updatedAt: z.number(),
  publishAt: z.number().nullable().default(null),
  publishedAt: z.number().nullable().default(null),
});

export type Video = z.infer<typeof videoSchema>;

/** A video joined with its live engagement counts, used by the UI. */
export type VideoWithStats = Video & { views: number; likes: number };

/* ───────────────────────── Category ───────────────────────── */

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().default(""),
  createdAt: z.number(),
});
export type Category = z.infer<typeof categorySchema>;

/* ───────────────────────── Tag ───────────────────────── */

export const tagSchema = z.object({
  slug: z.string(),
  name: z.string(),
  createdAt: z.number(),
});
export type Tag = z.infer<typeof tagSchema>;

/* ───────────────────────── Playlist ───────────────────────── */

export const playlistSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().default(""),
  createdAt: z.number(),
});
export type Playlist = z.infer<typeof playlistSchema>;

/* ───────────────────────── Course / Module / Lesson ───────────────────────── */

/**
 * A course groups ordered modules of lessons. Access/monetization reuse the
 * same vocabulary as videos (free | subscribers | purchase), so entitlements
 * are uniform across standalone videos and course content.
 */
export const courseSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().default(""),
  body: z.string().default(""),
  customPosterUrl: z.string().nullable().default(null),
  publishStatus: z.enum(publishStatuses).default("draft"),
  visibility: z.enum(visibilities).default("public"),
  access: z.enum(accessLevels).default("free"),
  requiredPlanIds: z.array(z.string()).default([]),
  polarProductId: z.string().nullable().default(null),
  priceAmount: z.number().nullable().default(null),
  dripEnabled: z.boolean().default(false),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  publishAt: z.number().nullable().default(null),
  publishedAt: z.number().nullable().default(null),
});
export type Course = z.infer<typeof courseSchema>;

export const moduleSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  position: z.number().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Module = z.infer<typeof moduleSchema>;

export const lessonSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  // denormalized parent course; kept in sync by a DB trigger.
  courseId: z.string(),
  // the video this lesson plays (null while curriculum is being built).
  videoId: z.string().nullable().default(null),
  title: z.string(),
  description: z.string().default(""),
  slug: z.string(),
  position: z.number().default(0),
  publishStatus: z.enum(publishStatuses).default("draft"),
  // days after course start before this lesson unlocks (0 = immediate).
  dripDays: z.number().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Lesson = z.infer<typeof lessonSchema>;

/* ───────────────────────── Comment ───────────────────────── */

export const commentStatuses = ["published", "flagged", "removed"] as const;
export type CommentStatus = (typeof commentStatuses)[number];

export const commentSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  userId: z.string(),
  authorName: z.string(),
  authorImage: z.string().nullable().default(null),
  body: z.string(),
  createdAt: z.number(),
  status: z.enum(commentStatuses).default("published"),
  aiReason: z.string().nullable().default(null),
});
export type Comment = z.infer<typeof commentSchema>;

/* ───────────────────────── Plan / Purchase (monetization) ───────────────────────── */

export const planIntervals = ["month", "year"] as const;
export type PlanInterval = (typeof planIntervals)[number];

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  polarProductId: z.string(),
  interval: z.enum(planIntervals).default("month"),
  amount: z.number().default(0),
  currency: z.string().default("usd"),
  createdAt: z.number(),
});
export type Plan = z.infer<typeof planSchema>;

export const purchaseSchema = z.object({
  userId: z.string(),
  videoId: z.string(),
  polarOrderId: z.string().nullable().default(null),
  amount: z.number().default(0),
  currency: z.string().default("usd"),
  createdAt: z.number(),
});
export type Purchase = z.infer<typeof purchaseSchema>;

/* ───────────────────────── Learner progress ───────────────────────── */

export const lessonProgressSchema = z.object({
  userId: z.string(),
  lessonId: z.string(),
  courseId: z.string(),
  positionSeconds: z.number().default(0),
  durationSeconds: z.number().nullable().default(null),
  completedAt: z.number().nullable().default(null),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type LessonProgress = z.infer<typeof lessonProgressSchema>;

export const courseProgressSchema = z.object({
  userId: z.string(),
  courseId: z.string(),
  completedLessons: z.number().default(0),
  totalLessons: z.number().default(0),
  percent: z.number().default(0),
  lastLessonId: z.string().nullable().default(null),
  completedAt: z.number().nullable().default(null),
  updatedAt: z.number(),
});
export type CourseProgress = z.infer<typeof courseProgressSchema>;

export const certificateSchema = z.object({
  id: z.string(),
  serial: z.string(),
  userId: z.string(),
  courseId: z.string(),
  recipientName: z.string().default(""),
  courseTitle: z.string().default(""),
  issuedAt: z.number(),
});
export type Certificate = z.infer<typeof certificateSchema>;

/**
 * Zod schema for the progress beacon body (used by the API route, S7-style).
 * `lessonId` comes from the route param; the body carries only the numbers.
 * Bounds guard against absurd values (max 24h) from a forged/buggy client.
 */
export const saveProgressInput = z.object({
  position: z
    .number()
    .nonnegative()
    .max(60 * 60 * 24),
  duration: z
    .number()
    .positive()
    .max(60 * 60 * 24)
    .nullable()
    .optional(),
});
export type SaveProgressInput = z.infer<typeof saveProgressInput>;

/* ───────────────────────── Settings ───────────────────────── */

export const registrationModes = ["open", "invite", "closed"] as const;
export type RegistrationMode = (typeof registrationModes)[number];

export const settingsSchema = z.object({
  siteName: z.string().default("Behind The Agents"),
  tagline: z.string().default("An open-source video platform."),
  logoUrl: z.string().nullable().default(null),
  faviconUrl: z.string().nullable().default(null),
  accentColor: z.string().default("#8b5cf6"),
  defaultTheme: z.enum(["light", "dark", "system"]).default("dark"),
  socialLinks: z
    .object({
      x: z.string().default(""),
      youtube: z.string().default(""),
      instagram: z.string().default(""),
      github: z.string().default(""),
      website: z.string().default(""),
    })
    .default({ x: "", youtube: "", instagram: "", github: "", website: "" }),
  featuredVideoIds: z.array(z.string()).default([]),
  carouselSource: z.enum(["popular", "latest"]).default("popular"),
  registrationMode: z.enum(registrationModes).default("open"),
  commentsEnabled: z.boolean().default(true),
  aiModeration: z.boolean().default(false),
  defaultDescription: z
    .string()
    .default("A beautiful, single-publisher video platform."),
  defaultOgImage: z.string().nullable().default(null),
  defaultAccess: z.enum(accessLevels).default("free"),
  currency: z.string().default("usd"),
  analyticsId: z.string().default(""),
  liveInputUid: z.string().default(""),
  liveTitle: z.string().default(""),
  updatedAt: z.number().default(() => Date.now()),
});
export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});

/* ───────────────────────── Profile ───────────────────────── */

export type Profile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  banned: boolean;
  createdAt: number;
};

/* ───────────────────────── Pagination ───────────────────────── */

export type Page<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
};

export const videoSorts = ["popular", "recent", "liked"] as const;
export type VideoSort = (typeof videoSorts)[number];

const oneOf = <T extends string>(
  allowed: readonly T[],
  v: unknown,
): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;

/** Coerce untrusted input to a VideoSort, falling back to `popular`. */
export const coerceVideoSort = (v: unknown): VideoSort =>
  oneOf(videoSorts, v) ?? "popular";

/** Coerce untrusted input to a PublishStatus, or `undefined` for "no filter". */
export const coercePublishStatus = (v: unknown): PublishStatus | undefined =>
  oneOf(publishStatuses, v);
