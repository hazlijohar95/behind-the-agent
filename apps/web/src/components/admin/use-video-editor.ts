import type { AccessLevel, Video, Visibility } from "@btc/db";
import { streamThumbnailUrl } from "@btc/ui";
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import * as React from "react";
import { deleteVideoAction, saveVideoAction } from "@/server/admin";

type SaveIntent = "save" | "publish" | "unpublish" | "schedule";

const SAVE_LABEL: Record<SaveIntent, string> = {
  save: "Saved",
  publish: "Published",
  unpublish: "Unpublished",
  schedule: "Scheduled",
};

/**
 * Owns the video-editor form state and its save / thumbnail-upload / delete
 * actions, keeping the presentational cards dumb. `busy` is the in-flight action
 * key (e.g. "save", "publish", "thumb", "delete") or null.
 */
export function useVideoEditor(video: Video) {
  const router = useRouter();
  const [title, setTitle] = React.useState(video.title);
  const [description, setDescription] = React.useState(video.description);
  const [categoryId, setCategoryId] = React.useState<string>(
    video.categoryId ?? "none",
  );
  const [tagsText, setTagsText] = React.useState(video.tags.join(", "));
  const [access, setAccess] = React.useState<AccessLevel>(video.access);
  const [visibility, setVisibility] = React.useState<Visibility>(
    video.visibility,
  );
  const [thumbnailTime, setThumbnailTime] = React.useState<string>(
    video.thumbnailTime != null ? String(video.thumbnailTime) : "",
  );
  const [scheduleAt, setScheduleAt] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const tags = tagsText
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const posterPreview =
    video.customPosterUrl ??
    (video.streamUid && video.playbackPolicy === "public"
      ? streamThumbnailUrl(video.streamUid, {
          width: 640,
          time: thumbnailTime ? Number(thumbnailTime) : undefined,
        })
      : null);

  async function save(intent: SaveIntent) {
    setBusy(intent);
    try {
      const res = await saveVideoAction({
        data: {
          id: video.id,
          title,
          description,
          categoryId: categoryId === "none" ? null : categoryId,
          tags,
          access,
          visibility,
          thumbnailTime: thumbnailTime === "" ? null : Number(thumbnailTime),
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

  async function uploadThumbnail(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("thumb");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("videoId", video.id);
      const res = await fetch("/api/admin/thumbnail", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Upload failed");
      }
      toast.success("Thumbnail updated");
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Delete this video permanently? This cannot be undone."))
      return;
    setBusy("delete");
    try {
      await deleteVideoAction({ data: { id: video.id } });
      toast.success("Video deleted");
      router.navigate({ to: "/admin/videos" });
    } catch {
      toast.error("Could not delete");
      setBusy(null);
    }
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    categoryId,
    setCategoryId,
    tagsText,
    setTagsText,
    access,
    setAccess,
    visibility,
    setVisibility,
    thumbnailTime,
    setThumbnailTime,
    scheduleAt,
    setScheduleAt,
    busy,
    fileRef,
    posterPreview,
    save,
    uploadThumbnail,
    remove,
  };
}

export type VideoEditorController = ReturnType<typeof useVideoEditor>;
