import type { Lesson, Module } from "@btc/db";
import { Badge } from "@btc/ui/components/badge";
import { Button } from "@btc/ui/components/button";
import { Input } from "@btc/ui/components/input";
import { Label } from "@btc/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@btc/ui/components/select";
import { Spinner } from "@btc/ui/components/spinner";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { useAction } from "@/hooks/use-action";
import {
  createLessonAction,
  createModuleAction,
  deleteLessonAction,
  deleteModuleAction,
  updateLessonAction,
  updateModuleAction,
} from "@/server/courses";

/** A pickable video for attaching to a lesson (id + display title only). */
export type LessonVideoOption = { id: string; title: string };

export type ModuleWithLessons = Module & { lessons: Lesson[] };

const NONE = "none";

/**
 * The modules → lessons curriculum editor for a course. All edits go through
 * the admin server actions and rely on `useAction` for busy/toast/invalidate,
 * so the tree reflects the server after each change (no optimistic local tree
 * to drift). `videos` is the set of ready videos a lesson can play.
 */
export function CurriculumBuilder({
  courseId,
  modules,
  videos,
}: {
  courseId: string;
  modules: ModuleWithLessons[];
  videos: LessonVideoOption[];
}) {
  const { busyId, run } = useAction();
  const [moduleTitle, setModuleTitle] = React.useState("");

  function addModule(e: React.FormEvent) {
    e.preventDefault();
    const title = moduleTitle.trim();
    if (!title) return;
    run("add-module", () => createModuleAction({ data: { courseId, title } }), {
      success: "Module added",
      error: "Could not add module",
      onSuccess: () => setModuleTitle(""),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-medium tracking-tight">
          Curriculum
        </h2>
        <p className="text-sm text-muted-foreground">
          Group lessons into modules. Each lesson plays one of your videos.
        </p>
      </div>

      {modules.length === 0 ? (
        <p className="glass rounded-xl px-4 py-8 text-center text-sm text-muted-foreground">
          No modules yet. Add your first module to start building the
          curriculum.
        </p>
      ) : (
        <div className="space-y-3">
          {modules.map((m) => (
            <ModuleCard
              key={m.id}
              courseId={courseId}
              module={m}
              videos={videos}
              busyId={busyId}
              run={run}
            />
          ))}
        </div>
      )}

      <form onSubmit={addModule} className="flex flex-wrap gap-2">
        <Input
          value={moduleTitle}
          onChange={(e) => setModuleTitle(e.target.value)}
          placeholder="New module title"
          className="max-w-xs"
        />
        <Button
          type="submit"
          variant="gradient"
          disabled={busyId === "add-module"}
        >
          {busyId === "add-module" ? <Spinner /> : <Plus className="size-4" />}
          Add module
        </Button>
      </form>
    </div>
  );
}

type RunFn = ReturnType<typeof useAction>["run"];

function ModuleCard({
  courseId,
  module,
  videos,
  busyId,
  run,
}: {
  courseId: string;
  module: ModuleWithLessons;
  videos: LessonVideoOption[];
  busyId: string | null;
  run: RunFn;
}) {
  const [open, setOpen] = React.useState(true);
  const [lessonTitle, setLessonTitle] = React.useState("");

  function rename() {
    const next = window.prompt("Rename module", module.title);
    if (!next || next.trim() === module.title) return;
    run(
      module.id,
      () => updateModuleAction({ data: { id: module.id, title: next.trim() } }),
      { success: "Renamed", error: "Could not rename" },
    );
  }

  function removeModule() {
    if (
      !confirm(
        "Delete this module and all its lessons? Learner progress for those lessons is also removed.",
      )
    )
      return;
    run(module.id, () => deleteModuleAction({ data: { id: module.id } }), {
      success: "Module deleted",
      error: "Could not delete module",
    });
  }

  function addLesson(e: React.FormEvent) {
    e.preventDefault();
    const title = lessonTitle.trim();
    if (!title) return;
    run(
      `add-lesson-${module.id}`,
      () =>
        createLessonAction({
          data: { moduleId: module.id, courseId, title },
        }),
      {
        success: "Lesson added",
        error: "Could not add lesson",
        onSuccess: () => setLessonTitle(""),
      },
    );
  }

  return (
    <div className="glass rounded-xl">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={open ? "Collapse module" : "Expand module"}
        >
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={rename}
          className="flex-1 text-left font-medium hover:text-primary"
        >
          {module.title}
        </button>
        <Badge variant="outline" className="text-xs">
          {module.lessons.length}{" "}
          {module.lessons.length === 1 ? "lesson" : "lessons"}
        </Badge>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-destructive"
          disabled={busyId === module.id}
          onClick={removeModule}
        >
          {busyId === module.id ? <Spinner /> : <Trash2 className="size-4" />}
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {module.lessons.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No lessons in this module yet.
            </p>
          ) : (
            module.lessons.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                videos={videos}
                busyId={busyId}
                run={run}
              />
            ))
          )}

          <form onSubmit={addLesson} className="flex flex-wrap gap-2 pt-1">
            <Input
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="New lesson title"
              className="h-9 max-w-xs"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={busyId === `add-lesson-${module.id}`}
            >
              {busyId === `add-lesson-${module.id}` ? (
                <Spinner />
              ) : (
                <Plus className="size-4" />
              )}
              Add lesson
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  videos,
  busyId,
  run,
}: {
  lesson: Lesson;
  videos: LessonVideoOption[];
  busyId: string | null;
  run: RunFn;
}) {
  const busy = busyId === lesson.id;

  function setVideo(value: string) {
    run(
      lesson.id,
      () =>
        updateLessonAction({
          data: { id: lesson.id, videoId: value === NONE ? null : value },
        }),
      { error: "Could not attach video" },
    );
  }

  function togglePublished() {
    const next = lesson.publishStatus === "published" ? "draft" : "published";
    run(
      lesson.id,
      () =>
        updateLessonAction({ data: { id: lesson.id, publishStatus: next } }),
      {
        success: next === "published" ? "Lesson published" : "Lesson hidden",
        error: "Could not update lesson",
      },
    );
  }

  function setDrip(value: string) {
    const days = Math.max(0, Math.floor(Number(value) || 0));
    run(
      lesson.id,
      () => updateLessonAction({ data: { id: lesson.id, dripDays: days } }),
      { error: "Could not set drip" },
    );
  }

  function rename() {
    const next = window.prompt("Rename lesson", lesson.title);
    if (!next || next.trim() === lesson.title) return;
    run(
      lesson.id,
      () => updateLessonAction({ data: { id: lesson.id, title: next.trim() } }),
      { success: "Renamed", error: "Could not rename" },
    );
  }

  function remove() {
    if (!confirm("Delete this lesson? Learner progress for it is removed."))
      return;
    run(lesson.id, () => deleteLessonAction({ data: { id: lesson.id } }), {
      success: "Lesson deleted",
      error: "Could not delete lesson",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      <button
        type="button"
        onClick={rename}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary"
      >
        {lesson.title}
      </button>

      <div className="w-44">
        <Select value={lesson.videoId ?? NONE} onValueChange={setVideo}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="No video" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No video</SelectItem>
            {videos.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Label htmlFor={`drip-${lesson.id}`} className="text-xs">
          Drip
        </Label>
        <Input
          id={`drip-${lesson.id}`}
          type="number"
          min={0}
          defaultValue={lesson.dripDays}
          onBlur={(e) => {
            if (Number(e.target.value) !== lesson.dripDays)
              setDrip(e.target.value);
          }}
          className="h-8 w-16 text-xs"
        />
        <span className="text-xs text-muted-foreground">d</span>
      </div>

      <Button
        size="sm"
        variant={lesson.publishStatus === "published" ? "outline" : "secondary"}
        disabled={busy}
        onClick={togglePublished}
      >
        {busy ? (
          <Spinner />
        ) : lesson.publishStatus === "published" ? (
          "Published"
        ) : (
          "Draft"
        )}
      </Button>

      <Button
        size="icon-sm"
        variant="ghost"
        className="text-destructive"
        disabled={busy}
        onClick={remove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
