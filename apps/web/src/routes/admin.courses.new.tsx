import { Button } from "@btc/ui/components/button";
import { Input } from "@btc/ui/components/input";
import { Label } from "@btc/ui/components/label";
import { Spinner } from "@btc/ui/components/spinner";
import { Textarea } from "@btc/ui/components/textarea";
import { toast } from "@btc/ui/components/toaster";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { createCourseAction } from "@/server/courses";

export const Route = createFileRoute("/admin/courses/new")({
  component: NewCoursePage,
});

function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Give the course a title");
      return;
    }
    setBusy(true);
    try {
      const res = await createCourseAction({
        data: { title: trimmed, description: description.trim() || undefined },
      });
      // Land in the editor so the operator can build the curriculum next.
      // createCourseAction resolves with the new id or throws (requireAdmin /
      // repo error), which the catch below surfaces as a toast.
      router.navigate({ to: "/admin/courses/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          New course
        </h1>
        <p className="text-sm text-muted-foreground">
          Start with a title. You&apos;ll add modules, lessons, pricing, and
          publish on the next screen.
        </p>
      </div>

      <form onSubmit={create} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Building Agents from Scratch"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Short description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — one or two sentences."
            rows={3}
          />
        </div>
        <Button type="submit" variant="gradient" disabled={busy}>
          {busy ? <Spinner /> : null}
          Create course
        </Button>
      </form>
    </div>
  );
}
