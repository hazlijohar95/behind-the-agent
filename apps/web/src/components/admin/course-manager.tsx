import type { AccessLevel, Category, Course, Visibility } from "@btc/db";
import { Button } from "@btc/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@btc/ui/components/card";
import { Input } from "@btc/ui/components/input";
import { Label } from "@btc/ui/components/label";
import { RichEditor } from "@btc/ui/components/rich-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@btc/ui/components/select";
import { Spinner } from "@btc/ui/components/spinner";
import { Switch } from "@btc/ui/components/switch";
import { Textarea } from "@btc/ui/components/textarea";
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import * as React from "react";
import { deleteCourseAction, saveCourseAction } from "@/server/courses";

type SaveIntent = "save" | "publish" | "unpublish" | "schedule";

const SAVE_LABEL: Record<SaveIntent, string> = {
  save: "Saved",
  publish: "Published",
  unpublish: "Unpublished",
  schedule: "Scheduled",
};

/**
 * Course settings form: metadata, monetization (access + Polar product),
 * drip, and the publish lifecycle. Mirrors the video editor's controller
 * pattern (single in-flight `busy` key, save-by-intent). Curriculum editing
 * lives in {@link CurriculumBuilder}, rendered alongside this on the edit page.
 */
export function CourseManager({
  course,
  categories,
  monetizationEnabled,
}: {
  course: Course;
  categories: Category[];
  monetizationEnabled: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(course.title);
  const [description, setDescription] = React.useState(course.description);
  const [body, setBody] = React.useState(course.body);
  const [categoryId, setCategoryId] = React.useState(
    course.categoryId ?? "none",
  );
  const [tagsText, setTagsText] = React.useState(course.tags.join(", "));
  const [access, setAccess] = React.useState<AccessLevel>(course.access);
  const [visibility, setVisibility] = React.useState<Visibility>(
    course.visibility,
  );
  const [polarProductId, setPolarProductId] = React.useState(
    course.polarProductId ?? "",
  );
  const [price, setPrice] = React.useState(
    course.priceAmount != null ? String(course.priceAmount / 100) : "",
  );
  const [dripEnabled, setDripEnabled] = React.useState(course.dripEnabled);
  const [scheduleAt, setScheduleAt] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const tags = tagsText
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const published = course.publishStatus === "published";

  async function save(intent: SaveIntent) {
    setBusy(intent);
    try {
      const res = await saveCourseAction({
        data: {
          id: course.id,
          title,
          description,
          body,
          categoryId: categoryId === "none" ? null : categoryId,
          tags,
          access,
          visibility,
          polarProductId: polarProductId.trim() || null,
          priceAmount: price === "" ? null : Math.round(Number(price) * 100),
          dripEnabled,
          intent,
          publishAt:
            intent === "schedule" && scheduleAt
              ? new Date(scheduleAt).getTime()
              : null,
        },
      });
      if (!res.ok) throw new Error(res.error);
      toast.success(SAVE_LABEL[intent]);
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (
      !confirm(
        "Delete this course permanently? Its modules and lessons will be removed. This cannot be undone.",
      )
    )
      return;
    setBusy("delete");
    try {
      await deleteCourseAction({ data: { id: course.id } });
      toast.success("Course deleted");
      router.navigate({ to: "/admin/courses" });
    } catch {
      toast.error("Could not delete");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="summary">Short description</Label>
          <Textarea
            id="summary"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One or two sentences shown in listings and previews."
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Landing page</Label>
          <RichEditor value={body} onChange={setBody} />
          <p className="text-xs text-muted-foreground">
            Rich description shown on the course page. Markdown is supported.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="comma, separated, tags"
            />
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Status:{" "}
              <span className="font-medium capitalize text-foreground">
                {course.publishStatus}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!!busy}
                onClick={() => save("save")}
              >
                {busy === "save" ? <Spinner /> : null}
                Save
              </Button>
              {published ? (
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => save("unpublish")}
                >
                  {busy === "unpublish" ? <Spinner /> : null}
                  Unpublish
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  disabled={!!busy}
                  onClick={() => save("publish")}
                >
                  {busy === "publish" ? <Spinner /> : null}
                  Publish
                </Button>
              )}
            </div>
            {!published && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <Label htmlFor="schedule" className="text-xs">
                  Or schedule
                </Label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!!busy || !scheduleAt}
                  onClick={() => save("schedule")}
                >
                  {busy === "schedule" ? <Spinner /> : null}
                  Schedule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {monetizationEnabled ? (
              <>
                <div className="space-y-1.5">
                  <Label>Who can watch</Label>
                  <Select
                    value={access}
                    onValueChange={(v) => setAccess(v as AccessLevel)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="subscribers">
                        Subscribers only
                      </SelectItem>
                      <SelectItem value="purchase">
                        One-time purchase
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {access === "purchase" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="product">Polar product ID</Label>
                      <Input
                        id="product"
                        value={polarProductId}
                        onChange={(e) => setPolarProductId(e.target.value)}
                        placeholder="prod_..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Required before you can publish a paid course.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="price">Price (display)</Label>
                      <Input
                        id="price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="49.00"
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Monetization is off, so every course is free. Enable Polar to
                sell courses or gate them for subscribers.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as Visibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Drip content</p>
                <p className="text-xs text-muted-foreground">
                  Unlock lessons over time per their drip schedule.
                </p>
              </div>
              <Switch checked={dripEnabled} onCheckedChange={setDripEnabled} />
            </div>
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          className="w-full text-destructive"
          disabled={!!busy}
          onClick={remove}
        >
          {busy === "delete" ? <Spinner /> : <Trash2 className="size-4" />}
          Delete course
        </Button>
      </aside>
    </div>
  );
}
