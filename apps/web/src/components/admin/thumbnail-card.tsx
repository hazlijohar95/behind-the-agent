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
import { Upload } from "lucide-react";
import type { VideoEditorController } from "./use-video-editor";

export function ThumbnailCard({ editor }: { editor: VideoEditorController }) {
  const {
    busy,
    thumbnailTime,
    setThumbnailTime,
    posterPreview,
    fileRef,
    uploadThumbnail,
  } = editor;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Thumbnail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="aspect-video overflow-hidden rounded-lg bg-muted">
          {posterPreview ? (
            <img
              src={posterPreview}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="thumbTime" className="text-xs">
            Thumbnail time (seconds)
          </Label>
          <Input
            id="thumbTime"
            type="number"
            min={0}
            value={thumbnailTime}
            onChange={(e) => setThumbnailTime(e.target.value)}
            placeholder="e.g. 12"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={uploadThumbnail}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!!busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "thumb" ? <Spinner /> : <Upload className="size-4" />}
          Upload custom
        </Button>
      </CardContent>
    </Card>
  );
}
