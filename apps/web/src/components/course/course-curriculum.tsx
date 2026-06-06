import { formatDuration } from "@btc/ui";
import { CheckCircle2, Lock, PlayCircle } from "lucide-react";

/** One lesson as shown on the public curriculum (metadata only, no playback). */
export type CurriculumLesson = {
  id: string;
  title: string;
  slug: string;
  durationSeconds: number | null;
  /** Whether the signed-in viewer has completed this lesson. */
  completed: boolean;
  /** True when the viewer can open this lesson (entitled + not drip-locked). */
  unlocked: boolean;
  /** Days until this lesson unlocks (drip), 0 when already available. */
  unlocksInDays: number;
};

export type CurriculumModule = {
  id: string;
  title: string;
  description: string;
  lessons: CurriculumLesson[];
};

/**
 * Public, read-only curriculum outline for a course landing page. Renders
 * modules and their published lessons with completion / lock state. It never
 * embeds a player or a stream id — playback (with the H2 signed-token gating)
 * is a separate concern; this is purely the syllabus the buyer evaluates.
 */
export function CourseCurriculum({ modules }: { modules: CurriculumModule[] }) {
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  if (lessonCount === 0) {
    return (
      <p className="rounded-xl border border-btc-border bg-btc-surface px-4 py-8 text-center text-sm text-btc-muted">
        The curriculum for this course is being prepared.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {modules.map((m, mi) => (
        <section key={m.id} className="flex flex-col gap-3">
          <div>
            <h3 className="text-[18px] font-medium text-btc-text">
              {mi + 1}. {m.title}
            </h3>
            {m.description && (
              <p className="mt-1 text-[14px] text-btc-muted">{m.description}</p>
            )}
          </div>
          <ol className="flex flex-col divide-y divide-btc-border overflow-hidden rounded-lg border border-btc-border">
            {m.lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex items-center gap-3 bg-btc-surface px-4 py-3"
              >
                <LessonIcon lesson={lesson} />
                <span className="min-w-0 flex-1 truncate text-[14px] text-btc-text">
                  {lesson.title}
                </span>
                {lesson.unlocksInDays > 0 && (
                  <span className="shrink-0 font-mono text-[12px] text-btc-muted">
                    unlocks in {lesson.unlocksInDays}d
                  </span>
                )}
                {lesson.durationSeconds ? (
                  <span className="shrink-0 font-mono text-[12px] text-btc-muted">
                    {formatDuration(lesson.durationSeconds)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function LessonIcon({ lesson }: { lesson: CurriculumLesson }) {
  if (lesson.completed)
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />;
  if (!lesson.unlocked)
    return <Lock className="size-4 shrink-0 text-btc-muted" />;
  return <PlayCircle className="size-4 shrink-0 text-btc-muted" />;
}
