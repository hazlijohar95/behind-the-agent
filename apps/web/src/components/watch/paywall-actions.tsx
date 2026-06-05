import { Button } from "@btc/ui/components/button";
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import * as React from "react";
import { startCheckout } from "@/lib/billing-client";

export function PaywallActions({
  videoId,
  reason,
}: {
  videoId: string;
  reason: "needs-subscription" | "needs-purchase" | "needs-signin";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  if (reason === "needs-signin") {
    return (
      <Button
        variant="gradient"
        className="rounded-full"
        onClick={() =>
          router.navigate({
            to: `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
          })
        }
      >
        Sign in to watch
      </Button>
    );
  }

  async function checkout(mode: "subscription" | "purchase") {
    setPending(true);
    try {
      window.location.href = await startCheckout(
        mode === "purchase" ? { mode, videoId } : { mode },
      );
    } catch {
      toast.error("Could not start checkout");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button
        variant="gradient"
        className="rounded-full"
        disabled={pending}
        onClick={() =>
          checkout(reason === "needs-purchase" ? "purchase" : "subscription")
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Lock className="size-4" />
        )}
        {reason === "needs-purchase" ? "Buy this video" : "Subscribe to watch"}
      </Button>
    </div>
  );
}
