import { Button } from "@btc/ui/components/button";
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import * as React from "react";
import { CheckoutError, startCheckout } from "@/lib/billing-client";
import { startCourseCheckout } from "@/lib/course-checkout";

export type EnrollReason =
  | "free"
  | "subscriber"
  | "purchased"
  | "needs-subscription"
  | "needs-purchase"
  | "needs-signin";

/**
 * The course landing CTA. Maps the {@link EnrollReason} from
 * `resolveCourseAccess` to the right action:
 *
 *   free / subscriber / purchased  → already entitled; "Start course".
 *   needs-signin                   → /login (preserving return path).
 *   needs-subscription             → Polar subscription checkout.
 *   needs-purchase                 → Polar one-time course checkout.
 *
 * Entitled viewers get a primary "Start course" that jumps to the first lesson
 * (when provided). 401s during checkout bounce to login.
 */
export function CourseEnroll({
  courseId,
  reason,
  priceLabel,
  firstLessonHref,
}: {
  courseId: string;
  reason: EnrollReason;
  priceLabel?: string | null;
  firstLessonHref?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const entitled =
    reason === "free" || reason === "subscriber" || reason === "purchased";

  function goLogin() {
    router.navigate({
      to: `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
    });
  }

  async function buy(kind: "subscription" | "course") {
    setPending(true);
    try {
      const url =
        kind === "course"
          ? await startCourseCheckout(courseId)
          : await startCheckout({ mode: "subscription" });
      window.location.href = url;
    } catch (err) {
      if (err instanceof CheckoutError && err.status === 401) {
        goLogin();
        return;
      }
      toast.error("Could not start checkout");
      setPending(false);
    }
  }

  if (entitled) {
    if (!firstLessonHref) {
      return (
        <p className="text-sm text-muted-foreground">
          You have access to this course. Lessons appear below.
        </p>
      );
    }
    return (
      <Button
        variant="gradient"
        className="rounded-full"
        onClick={() => {
          window.location.href = firstLessonHref;
        }}
      >
        Start course
      </Button>
    );
  }

  if (reason === "needs-signin") {
    return (
      <Button variant="gradient" className="rounded-full" onClick={goLogin}>
        Sign in to enroll
      </Button>
    );
  }

  const isPurchase = reason === "needs-purchase";

  return (
    <Button
      variant="gradient"
      className="rounded-full"
      disabled={pending}
      onClick={() => buy(isPurchase ? "course" : "subscription")}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Lock className="size-4" />
      )}
      {isPurchase
        ? priceLabel
          ? `Buy course · ${priceLabel}`
          : "Buy this course"
        : "Subscribe to enroll"}
    </Button>
  );
}
