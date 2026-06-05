import { Button } from "@btc/ui/components/button";
import { Input } from "@btc/ui/components/input";
import { Spinner } from "@btc/ui/components/spinner";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useAction } from "@/hooks/use-action";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/admin";

export type CategoryRow = {
  id: string;
  name: string;
  description: string;
  count: number;
};

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const { busyId, run } = useAction();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await run(
      "create",
      () =>
        createCategoryAction({
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
          },
        }),
      {
        success: "Category created",
        error: "Could not create category",
        onSuccess: () => {
          setName("");
          setDescription("");
        },
      },
    );
  }

  function rename(id: string, current: string) {
    const next = window.prompt("Rename category", current);
    if (!next || next === current) return;
    run(
      id,
      () => updateCategoryAction({ data: { id, input: { name: next } } }),
      { success: "Renamed", error: "Could not rename" },
    );
  }

  function editDescription(id: string, current: string) {
    const next = window.prompt(
      "Category description (shown on the home page)",
      current,
    );
    if (next === null || next === current) return;
    run(
      id,
      () =>
        updateCategoryAction({ data: { id, input: { description: next } } }),
      { success: "Description updated", error: "Could not update description" },
    );
  }

  function remove(id: string) {
    if (!confirm("Delete this category? Videos will become uncategorized."))
      return;
    run(id, () => deleteCategoryAction({ data: { id } }), {
      success: "Deleted",
      error: "Could not delete",
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className="max-w-xs"
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional, shown on home)"
          className="min-w-[16rem] flex-1"
        />
        <Button type="submit" variant="gradient" disabled={busyId === "create"}>
          {busyId === "create" ? <Spinner /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>

      <div className="glass divide-y divide-border rounded-xl">
        {categories.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No categories yet.
          </p>
        )}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => rename(c.id, c.name)}
                className="text-left font-medium hover:text-primary"
              >
                {c.name}
              </button>
              <button
                type="button"
                onClick={() => editDescription(c.id, c.description)}
                className="block max-w-full truncate text-left text-xs text-muted-foreground hover:text-primary"
              >
                {c.description || "Add a description…"}
              </button>
              <p className="text-xs text-muted-foreground">{c.count} videos</p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive"
              disabled={busyId === c.id}
              onClick={() => remove(c.id)}
            >
              {busyId === c.id ? <Spinner /> : <Trash2 className="size-4" />}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
