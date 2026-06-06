/** One course on the "Continue learning" rail (enriched in the loader). */
export type ContinueLearningItem = {
  courseId: string;
  courseTitle: string;
  /** 0–100 from the course_progress rollup. */
  percent: number;
  /**
   * Resume target: the COURSE-AWARE lesson watch route
   * (`/course/$courseSlug/$lessonSlug`), so resuming honors course entitlement
   * + drip. Both are null while the resume lesson can't be resolved (e.g. the
   * lesson was deleted) — the tile is then non-interactive.
   */
  courseSlug: string | null;
  lessonSlug: string | null;
  resumeLessonTitle: string | null;
  /** Cloudflare Stream uid for the poster thumbnail; null when unavailable. */
  posterStreamUid: string | null;
  posterThumbnailTime: number | null;
};

/** An earned certificate shown in the account list (links to /cert/$serial). */
export type EarnedCertificate = {
  serial: string;
  courseTitle: string;
  issuedAt: number;
};

export type AccountData = {
  user: { name: string; email: string; image: string | null };
  monetizationEnabled: boolean;
  billing: {
    status: string | null;
    planName: string | null;
    currentPeriodEnd: number | null;
  } | null;
  hasPlans: boolean;
  purchases: {
    videoId: string;
    title: string;
    slug: string;
    amount: number;
    currency: string;
  }[];
  /** In-progress courses for the "Continue learning" rail. Empty → hidden. */
  continueLearning: ContinueLearningItem[];
  /** Earned completion certificates. Empty → hidden. */
  certificates: EarnedCertificate[];
};
