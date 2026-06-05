import { Avatar, AvatarFallback, AvatarImage } from "@btc/ui/components/avatar";
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
import * as React from "react";
import { useAction } from "@/hooks/use-action";
import { updateDisplayNameAction } from "@/server/account";
import type { AccountData } from "./types";

export function ProfileCard({ user }: { user: AccountData["user"] }) {
  const { busy, run } = useAction();
  const [name, setName] = React.useState(user.name);
  const initials = (user.name || user.email || "?").slice(0, 2).toUpperCase();

  function save() {
    if (!name.trim() || name === user.name) return;
    run(
      "save",
      () => updateDisplayNameAction({ data: { name: name.trim() } }),
      {
        success: "Profile updated",
        error: "Could not update profile",
      },
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name} />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-lg text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <div className="flex gap-2">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={save} disabled={busy || name === user.name}>
              {busy ? <Spinner /> : null} Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
