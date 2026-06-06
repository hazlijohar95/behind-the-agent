import type { AccessLevel, Video, Visibility } from "@btc/db";
import { streamThumbnailUrl } from "@btc/ui";
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import * as React from "react";
import {
  generateMetadataAction,
  type VideoMetadataSuggestion,
} from "@/lib/ai-metadata";
import { deleteVideoAction, saveVideoAction } from "@/server/admin";

type SaveIntent = "save" | "publish" | "unpublish" | "schedule";

const SAVE_LABEL: Record<SaveIntent, string> = {
  save: "Saved",
  publish: "Published",
  unpublish: "Unpublished",
  schedule: "Scheduled",
};

/** Format seconds as `m:ss`, or `h:mm:ss` once past an hour. */
function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * Render AI-proposed chapters as markdown the editor already understands: each
 * line links a `[m:ss](#t=seconds)` timecode (the RichEditor's own timestamp
 * convention, which the player seeks to) to its chapter title. Returns an empty
 * string when there are no chapters so the description isn't padded.
 */
function chaptersToMarkdown(
  chapters: VideoMetadataSuggestion["chapters"],
): string {
  if (chapters.length === 0) return "";
  const lines = chapters.map(
    (c) =>
      `- [${formatTimecode(c.startSeconds)}](#t=${c.startSeconds}) ${c.title}`,
  );
  return `## Chapters\n\n${lines.join("\n")}`;
}

/**
 * Compose the editor description from a metadata suggestion: the prose summary,
 * followed by a "Chapters" section when the model returned timing cues.
 */
function suggestionToDescription(suggestion: VideoMetadataSuggestion): string {
  const chapters = chaptersToMarkdown(suggestion.chapters);
  return chapters
    ? `${suggestion.description}\n\n${chapters}`
    : suggestion.description;
}

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

  // AI auto-metadata. `transcriptText` is the source the admin supplies (the
  // stored transcript isn't carried on the client `Video`); `generating` gates
  // the button; `descriptionKey` is bumped to remount the RichEditor when the
  // description is replaced, since it only reads `value` as its initial content.
  const [transcriptText, setTranscriptText] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [descriptionKey, setDescriptionKey] = React.useState(0);

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

  /**
   * Generate title / description / tags / chapters from the supplied transcript
   * and pre-fill the form. Non-destructive in spirit: the admin can still edit
   * or save manually afterwards. Failures surface as a toast and leave the form
   * untouched.
   */
  async function generateMetadata() {
    const transcript = transcriptText.trim();
    if (!transcript) {
      toast.error("Paste a transcript first.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateMetadataAction({ data: { transcript } });
      if (!res.ok) throw new Error(res.error);
      const { suggestion } = res;
      if (suggestion.title) setTitle(suggestion.title);
      setDescription(suggestionToDescription(suggestion));
      // Remount the RichEditor so it picks up the new description content.
      setDescriptionKey((k) => k + 1);
      if (suggestion.tags.length) setTagsText(suggestion.tags.join(", "));
      toast.success("Metadata generated — review before saving.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate");
    } finally {
      setGenerating(false);
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
    transcriptText,
    setTranscriptText,
    generating,
    descriptionKey,
    generateMetadata,
    save,
    uploadThumbnail,
    remove,
  };
}

export type VideoEditorController = ReturnType<typeof useVideoEditor>;
