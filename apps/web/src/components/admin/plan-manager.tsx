import type { Plan, PlanInterval } from "@btc/db";
import { Button } from "@btc/ui/components/button";
import { Card, CardContent } from "@btc/ui/components/card";
import { Input } from "@btc/ui/components/input";
import { Label } from "@btc/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@btc/ui/components/select";
import { Spinner } from "@btc/ui/components/spinner";
import { toast } from "@btc/ui/components/toaster";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useAction } from "@/hooks/use-action";
import { createPlanAction, deletePlanAction } from "@/server/admin";

export function PlanManager({ plans }: { plans: Plan[] }) {
  const { busyId, run } = useAction();
  const [name, setName] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [interval, setInterval] = React.useState<PlanInterval>("month");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !productId.trim()) {
      toast.error("Name and Polar product ID are required");
      return;
    }
    await run(
      "create",
      () =>
        createPlanAction({
          data: {
            name: name.trim(),
            polarProductId: productId.trim(),
            interval,
            amount: Math.round(Number(amount) * 100) || 0,
            currency: "usd",
          },
        }),
      {
        success: "Plan created",
        error: "Could not create plan",
        onSuccess: () => {
          setName("");
          setProductId("");
          setAmount("");
        },
      },
    );
  }

  function remove(id: string) {
    if (!confirm("Delete this plan?")) return;
    run(id, () => deletePlanAction({ data: { id } }), {
      error: "Could not delete",
    });
  }

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardContent className="p-5">
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Plan name</Label>
              <Input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product">Polar product ID</Label>
              <Input
                id="product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="prod_..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (display)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="9.99"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interval</Label>
              <Select
                value={interval}
                onValueChange={(v) => setInterval(v as PlanInterval)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                variant="gradient"
                disabled={busyId === "create"}
              >
                {busyId === "create" ? (
                  <Spinner />
                ) : (
                  <Plus className="size-4" />
                )}
                Add plan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="glass divide-y divide-border rounded-xl">
        {plans.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No plans yet. Create one to enable subscriptions.
          </p>
        )}
        {plans.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                ${(p.amount / 100).toFixed(2)}/{p.interval} · {p.polarProductId}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive"
              disabled={busyId === p.id}
              onClick={() => remove(p.id)}
            >
              {busyId === p.id ? <Spinner /> : <Trash2 className="size-4" />}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
