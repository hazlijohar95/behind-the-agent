import { streamThumbnailUrl } from "@btc/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@btc/ui/components/card";
import { Link } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import type { ContinueLearningItem } from "./types";

/**
 * "Continue learning" rail: a horizontal list of the viewer's in-progress
 * courses, each with a poster, percent bar, and a Resume link to the saved
 * playback position. Renders nothing when there's nothing in progress (the
 * parent also length-guards, mirroring PurchasesCard).
 */
export function ContinueLearningCard({
  items,
}: {
  items: ContinueLearningItem[];
}) {
  if (items.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Continue learning</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex gap-4 overflow-x-auto pb-1">
          {items.map((item) => (
            <li key={item.courseId} className="w-56 shrink-0">
              <CourseTile item={item} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CourseTile({ item }: { item: ContinueLearningItem }) {
  const poster = item.posterStreamUid
    ? streamThumbnailUrl(item.posterStreamUid, {
        width: 320,
        height: 180,
        fit: "crop",
        time: item.posterThumbnailTime ?? undefined,
      })
    : null;

  const percent = Math.min(100, Math.max(0, Math.round(item.percent)));
  const canResume = item.courseSlug != null && item.lessonSlug != null;

  const tile = (
    <div className="group flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        {poster ? (
          <img
            src={poster}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <PlayCircle className="size-8" />
          </div>
        )}
        {canResume && (
          <div className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
            <PlayCircle className="size-10 text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        )}
      </div>

      {/* Percent bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="truncate text-sm font-medium" title={item.courseTitle}>
          {item.courseTitle}
        </span>
        <span className="text-xs text-muted-foreground">
          {percent}% complete
          {item.resumeLessonTitle ? ` · ${item.resumeLessonTitle}` : ""}
        </span>
      </div>
    </div>
  );

  // Resume target is the course-aware lesson watch page (entitlement + drip
  // enforced there). When the lesson can't be resolved, the tile is
  // non-interactive (no destination to resume to).
  if (!canResume || item.courseSlug == null || item.lessonSlug == null) {
    return tile;
  }
  return (
    <Link
      to="/course/$slug/$lessonSlug"
      params={{ slug: item.courseSlug, lessonSlug: item.lessonSlug }}
    >
      {tile}
    </Link>
  );
}
