import { Button } from "@btc/ui/components/button";
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import * as React from "react";
import { CheckoutError, startCheckout } from "@/lib/billing-client";
import { startCourseCheckout } from "@/lib/course-checkout";

export function PaywallActions({
  videoId,
  courseId,
  reason,
}: {
  videoId: string;
  /**
   * Present when the paywall guards a COURSE lesson. A `needs-purchase` then
   * starts the COURSE checkout (the backing video is `access:"free"` and has no
   * product of its own); absent, it starts the standalone video checkout.
   */
  courseId?: string;
  reason: "needs-subscription" | "needs-purchase" | "needs-signin";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  function goLogin() {
    router.navigate({
      to: `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
    });
  }

  if (reason === "needs-signin") {
    return (
      <Button variant="gradient" className="rounded-full" onClick={goLogin}>
        Sign in to watch
      </Button>
    );
  }

  async function checkout(mode: "subscription" | "purchase") {
    setPending(true);
    try {
      // A course lesson's purchase buys the COURSE, not the (free) backing
      // video — route to the course checkout endpoint in that case.
      const url =
        mode === "purchase"
          ? courseId
            ? await startCourseCheckout(courseId)
            : await startCheckout({ mode, videoId })
          : await startCheckout({ mode });
      window.location.href = url;
    } catch (err) {
      // 401 → send them to sign in (mirrors the course-landing enroll flow).
      if (err instanceof CheckoutError && err.status === 401) {
        goLogin();
        return;
      }
      toast.error("Could not start checkout");
      setPending(false);
    }
  }

  const isPurchase = reason === "needs-purchase";

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button
        variant="gradient"
        className="rounded-full"
        disabled={pending}
        onClick={() => checkout(isPurchase ? "purchase" : "subscription")}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Lock className="size-4" />
        )}
        {isPurchase
          ? courseId
            ? "Buy this course"
            : "Buy this video"
          : "Subscribe to watch"}
      </Button>
    </div>
  );
}
