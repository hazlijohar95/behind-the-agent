import {
  categoryRepo,
  courseRepo,
  lessonRepo,
  moduleRepo,
  videoRepo,
} from "@btc/db";
import { Separator } from "@btc/ui/components/separator";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { CourseManager } from "@/components/admin/course-manager";
import {
  CurriculumBuilder,
  type LessonVideoOption,
  type ModuleWithLessons,
} from "@/components/admin/curriculum-builder";
import { monetizationEnabled } from "@/lib/entitlements";
import { requireAdmin } from "@/lib/session";

const loadCourse = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    const course = await courseRepo.getCourse(data.id);
    if (!course) throw notFound();

    const [categories, moduleRows, videoPage] = await Promise.all([
      categoryRepo.listCategories(),
      moduleRepo.listByCourse(course.id),
      videoRepo.listAdminVideos({ limit: 200 }),
    ]);

    // Attach each module's lessons. Modules are few; one query per module is
    // fine for an admin-only screen.
    const modules: ModuleWithLessons[] = await Promise.all(
      moduleRows.map(async (m) => ({
        ...m,
        lessons: await lessonRepo.listByModule(m.id),
      })),
    );

    // Only ready videos can back a lesson (a still-encoding video has no
    // playable stream yet).
    const videos: LessonVideoOption[] = videoPage.items
      .filter((v) => v.processingStatus === "ready")
      .map((v) => ({ id: v.id, title: v.title }));

    return {
      course,
      categories,
      modules,
      videos,
      monetizationEnabled: monetizationEnabled(),
    };
  });

export const Route = createFileRoute("/admin/courses/$id")({
  loader: ({ params }) => loadCourse({ data: { id: params.id } }),
  component: EditCoursePage,
});

function EditCoursePage() {
  const { course, categories, modules, videos, monetizationEnabled } =
    Route.useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          {course.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Edit course details, build the curriculum, and publish.
        </p>
      </div>

      <CourseManager
        course={course}
        categories={categories}
        monetizationEnabled={monetizationEnabled}
      />

      <Separator />

      <CurriculumBuilder
        courseId={course.id}
        modules={modules}
        videos={videos}
      />
    </div>
  );
}
