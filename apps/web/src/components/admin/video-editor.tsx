import type { AccessLevel, Category, Video, Visibility } from "@btc/db";
import { Button } from "@btc/ui/components/button";
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
import { Trash2 } from "lucide-react";
import { ThumbnailCard } from "./thumbnail-card";
import { useVideoEditor } from "./use-video-editor";
import { VideoStatusCard } from "./video-status-card";

export function VideoEditor({
  video,
  categories,
  monetizationEnabled,
}: {
  video: Video;
  categories: Category[];
  monetizationEnabled: boolean;
}) {
  const editor = useVideoEditor(video);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={editor.title}
            onChange={(e) => editor.setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <RichEditor
            value={editor.description}
            onChange={editor.setDescription}
          />
          <p className="text-xs text-muted-foreground">
            Tip: insert timestamps to let viewers jump to a moment in the video.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={editor.categoryId}
              onValueChange={editor.setCategoryId}
            >
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
              value={editor.tagsText}
              onChange={(e) => editor.setTagsText(e.target.value)}
              placeholder="comma, separated, tags"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {monetizationEnabled && (
            <div className="space-y-1.5">
              <Label>Access</Label>
              <Select
                value={editor.access}
                onValueChange={(v) => editor.setAccess(v as AccessLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="subscribers">Subscribers only</SelectItem>
                  <SelectItem value="purchase">One-time purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Select
              value={editor.visibility}
              onValueChange={(v) => editor.setVisibility(v as Visibility)}
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
        </div>
      </div>

      <aside className="space-y-4">
        <VideoStatusCard video={video} editor={editor} />
        <ThumbnailCard editor={editor} />

        <Button
          variant="ghost"
          className="w-full text-destructive"
          disabled={!!editor.busy}
          onClick={editor.remove}
        >
          {editor.busy === "delete" ? (
            <Spinner />
          ) : (
            <Trash2 className="size-4" />
          )}
          Delete video
        </Button>
      </aside>
    </div>
  );
}
