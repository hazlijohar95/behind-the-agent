import type { AccessLevel } from "@btc/db";
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
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import * as React from "react";
import * as tus from "tus-js-client";

type Phase = "idle" | "starting" | "uploading";

export function UploadVideo({
  monetizationEnabled,
}: {
  monetizationEnabled: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [access, setAccess] = React.useState<AccessLevel>("free");
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState(0);

  async function startUpload() {
    if (!file) {
      toast.error("Choose a video file first");
      return;
    }
    setPhase("starting");
    try {
      // 1. Server provisions a one-time resumable upload URL and the video row.
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled video",
          access,
          uploadLength: file.size,
          fileName: file.name,
        }),
      });
      if (!res.ok) throw new Error();
      const { uploadUrl, videoId } = (await res.json()) as {
        uploadUrl: string;
        videoId: string;
      };

      // 2. Upload straight to Cloudflare Stream over tus (resumable, chunked).
      setPhase("uploading");
      const upload = new tus.Upload(file, {
        uploadUrl,
        chunkSize: 50 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        onError: () => {
          toast.error("Upload failed");
          setPhase("idle");
        },
        onProgress: (sent, total) => {
          setProgress(Math.round((sent / total) * 100));
        },
        onSuccess: () => {
          toast.success("Upload complete — processing on Cloudflare Stream.");
          router.navigate({ to: `/admin/videos/${videoId}` });
        },
      });
      upload.start();
    } catch {
      toast.error("Could not start upload");
      setPhase("idle");
    }
  }

  if (phase === "uploading") {
    return (
      <div className="max-w-lg space-y-4">
        <p className="text-sm text-muted-foreground">
          Uploading{" "}
          <span className="font-medium text-foreground">
            {title || file?.name || "video"}
          </span>
          . You can edit details while it processes.
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {progress}%
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My new video"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file">Video file</Label>
        <Input
          id="file"
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {monetizationEnabled && (
        <div className="space-y-1.5">
          <Label>Access</Label>
          <Select
            value={access}
            onValueChange={(v) => setAccess(v as AccessLevel)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free — anyone can watch</SelectItem>
              <SelectItem value="subscribers">Subscribers only</SelectItem>
              <SelectItem value="purchase">One-time purchase</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Gated videos use signed playback. You can change this later.
          </p>
        </div>
      )}

      <Button
        variant="gradient"
        onClick={startUpload}
        disabled={phase === "starting" || !file}
      >
        {phase === "starting" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        Start upload
      </Button>
    </div>
  );
}
