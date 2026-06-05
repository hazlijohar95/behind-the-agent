import { Badge } from "@btc/ui/components/badge";
import { Button } from "@btc/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@btc/ui/components/card";
import { Spinner } from "@btc/ui/components/spinner";
import { toast } from "@btc/ui/components/toaster";
import { CreditCard } from "lucide-react";
import * as React from "react";
import {
  type CheckoutInput,
  openBillingPortal,
  startCheckout,
} from "@/lib/billing-client";
import type { AccountData } from "./types";

export function SubscriptionCard({
  billing,
  hasPlans,
}: {
  billing: AccountData["billing"];
  hasPlans: boolean;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const active = billing?.status === "active" || billing?.status === "trialing";

  async function action(kind: "checkout" | "portal", input?: CheckoutInput) {
    setBusy(kind);
    try {
      window.location.href =
        kind === "portal"
          ? await openBillingPortal()
          : await startCheckout(input ?? { mode: "subscription" });
    } catch {
      toast.error("Something went wrong");
      setBusy(null);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5" /> Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active ? (
          <>
            <div className="flex items-center gap-2">
              <Badge>{billing?.planName ?? "Active"}</Badge>
              <span className="text-sm capitalize text-muted-foreground">
                {billing?.status}
              </span>
            </div>
            {billing?.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                Renews{" "}
                {new Date(billing.currentPeriodEnd * 1000).toLocaleDateString()}
              </p>
            )}
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => action("portal")}
            >
              {busy === "portal" ? <Spinner /> : null}
              Manage billing
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have an active subscription.
            </p>
            {hasPlans ? (
              <Button
                variant="gradient"
                disabled={!!busy}
                onClick={() => action("checkout", { mode: "subscription" })}
              >
                {busy === "checkout" ? <Spinner /> : null}
                Subscribe
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                No plans are available yet.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
