import { formatRelativeTime } from "@btc/ui";
import { Badge } from "@btc/ui/components/badge";
import { Button } from "@btc/ui/components/button";
import { Spinner } from "@btc/ui/components/spinner";
import { Check, EyeOff, Trash2 } from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { deleteCommentAction, setCommentStatusAction } from "@/server/admin";

export type ModComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: number;
  status: string;
  aiReason: string | null;
};

export function CommentModeration({ comments }: { comments: ModComment[] }) {
  const { busyId, run } = useAction();

  if (comments.length === 0) {
    return (
      <div className="glass rounded-xl py-12 text-center text-sm text-muted-foreground">
        Nothing to review.
      </div>
    );
  }

  return (
    <div className="glass divide-y divide-border rounded-xl">
      {comments.map((c) => (
        <div
          key={c.id}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
        >
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{c.authorName}</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(c.createdAt)}
              </span>
              {c.aiReason && (
                <Badge variant="outline" className="text-xs capitalize">
                  {c.aiReason}
                </Badge>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">
              {c.body}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId === c.id}
              onClick={() =>
                run(
                  c.id,
                  () =>
                    setCommentStatusAction({
                      data: { id: c.id, status: "published" },
                    }),
                  { success: "Approved" },
                )
              }
            >
              <Check className="size-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === c.id}
              onClick={() =>
                run(
                  c.id,
                  () =>
                    setCommentStatusAction({
                      data: { id: c.id, status: "removed" },
                    }),
                  { success: "Removed" },
                )
              }
            >
              <EyeOff className="size-4" /> Hide
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive"
              disabled={busyId === c.id}
              onClick={() =>
                run(c.id, () => deleteCommentAction({ data: { id: c.id } }), {
                  success: "Deleted",
                })
              }
            >
              {busyId === c.id ? <Spinner /> : <Trash2 className="size-4" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
