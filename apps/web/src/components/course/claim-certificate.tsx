import { Button } from "@btc/ui/components/button";
import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import { Award, Loader2 } from "lucide-react";
import * as React from "react";
import { claimCertificateAction } from "@/server/progress";

/**
 * "Claim certificate" CTA shown once a learner has completed a course (100%).
 *
 * Clicking calls {@link claimCertificateAction}, whose `issue_certificate` RPC
 * re-verifies completion server-side (the client can't assert it) and is
 * idempotent. On success we navigate to the public `/cert/$serial` page. If the
 * learner already holds a certificate, the parent renders the link directly and
 * this CTA isn't shown.
 */
export function ClaimCertificate({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function claim() {
    setPending(true);
    try {
      const result = await claimCertificateAction({ data: { courseId } });
      if (!result.ok) {
        toast.error(result.error ?? "Could not claim certificate");
        setPending(false);
        return;
      }
      router.navigate({
        to: "/cert/$serial",
        params: { serial: result.serial },
      });
    } catch {
      toast.error("Could not claim certificate");
      setPending(false);
    }
  }

  return (
    <Button
      variant="gradient"
      className="rounded-full"
      disabled={pending}
      onClick={claim}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Award className="size-4" />
      )}
      Claim your certificate
    </Button>
  );
}
