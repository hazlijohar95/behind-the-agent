import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@btc/ui/components/card";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { AccountData } from "./types";

export function PurchasesCard({
  purchases,
}: {
  purchases: AccountData["purchases"];
}) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Purchases</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {purchases.map((p) => (
          <Link
            key={p.videoId}
            to="/v/$slug"
            params={{ slug: p.slug }}
            className="flex items-center justify-between py-2.5 text-sm hover:text-primary"
          >
            <span>{p.title}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              ${(p.amount / 100).toFixed(2)}{" "}
              <ExternalLink className="size-3.5" />
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
