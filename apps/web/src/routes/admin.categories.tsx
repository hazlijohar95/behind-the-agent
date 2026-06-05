import { categoryRepo } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  CategoryManager,
  type CategoryRow,
} from "@/components/admin/category-manager";

const loadCategories = createServerFn({ method: "GET" }).handler(async () => {
  const categories = await categoryRepo.listCategories();
  const rows: CategoryRow[] = await Promise.all(
    categories.map(async (c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      count: await categoryRepo.countCategoryVideos(c.id),
    })),
  );
  return { rows };
});

export const Route = createFileRoute("/admin/categories")({
  loader: () => loadCategories(),
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  const { rows } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Categories
        </h1>
        <p className="text-sm text-muted-foreground">
          Organize your videos into browsable sections.
        </p>
      </div>
      <CategoryManager categories={rows} />
    </div>
  );
}
