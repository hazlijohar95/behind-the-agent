import type { Video } from "@btc/db";
import { Badge } from "@btc/ui/components/badge";
import { Button } from "@btc/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@btc/ui/components/card";
import { Input } from "@btc/ui/components/input";
import { Label } from "@btc/ui/components/label";
import { Spinner } from "@btc/ui/components/spinner";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { VideoEditorController } from "./use-video-editor";

export function VideoStatusCard({
  video,
  editor,
}: {
  video: Video;
  editor: VideoEditorController;
}) {
  const { busy, scheduleAt, setScheduleAt, save } = editor;
  const notReady = video.processingStatus !== "ready";

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Status
          <Badge
            variant={
              video.publishStatus === "published" ? "default" : "outline"
            }
            className="capitalize"
          >
            {video.publishStatus}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!!busy}
            onClick={() => save("save")}
          >
            {busy === "save" ? <Spinner /> : null} Save
          </Button>
          {video.publishStatus !== "published" ? (
            <Button
              size="sm"
              variant="gradient"
              disabled={!!busy || notReady}
              onClick={() => save("publish")}
            >
              {busy === "publish" ? <Spinner /> : null} Publish
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => save("unpublish")}
            >
              Unpublish
            </Button>
          )}
        </div>

        {notReady && (
          <p className="text-xs text-muted-foreground">
            Video is {video.processingStatus}. Publishing is available once
            it&apos;s ready.
          </p>
        )}

        <div className="space-y-1.5 border-t border-border pt-3">
          <Label htmlFor="schedule" className="text-xs">
            Schedule publish
          </Label>
          <div className="flex gap-2">
            <Input
              id="schedule"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy || !scheduleAt || notReady}
              onClick={() => save("schedule")}
            >
              Set
            </Button>
          </div>
        </div>

        {video.publishStatus === "published" && (
          <Link
            to="/v/$slug"
            params={{ slug: video.slug }}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View live <ExternalLink className="size-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
