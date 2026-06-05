import { Avatar, AvatarFallback, AvatarImage } from "@btc/ui/components/avatar";
import { Badge } from "@btc/ui/components/badge";
import { Button } from "@btc/ui/components/button";
import { Spinner } from "@btc/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@btc/ui/components/table";
import { Ban, Shield, ShieldOff, UserCheck } from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { banUserAction, setUserRoleAction } from "@/server/admin";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  banned: boolean;
};

export function UserManagement({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const { busyId, run } = useAction();

  return (
    <div className="glass overflow-hidden rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const initials = (u.name || u.email || "?")
              .slice(0, 2)
              .toUpperCase();
            const isAdmin = u.role === "admin";
            const isSelf = u.id === currentUserId;
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {u.image ? (
                        <AvatarImage src={u.image} alt={u.name} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {u.name}
                        {isSelf && (
                          <span className="text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {u.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isAdmin ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {u.role}
                    </Badge>
                    {u.banned && (
                      <Badge variant="outline" className="text-destructive">
                        Banned
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === u.id || isSelf}
                      onClick={() =>
                        run(u.id, () =>
                          setUserRoleAction({
                            data: {
                              userId: u.id,
                              role: isAdmin ? "user" : "admin",
                            },
                          }),
                        )
                      }
                    >
                      {busyId === u.id ? (
                        <Spinner />
                      ) : isAdmin ? (
                        <ShieldOff className="size-4" />
                      ) : (
                        <Shield className="size-4" />
                      )}
                      {isAdmin ? "Demote" : "Make admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={u.banned ? "" : "text-destructive"}
                      disabled={busyId === u.id || isSelf}
                      onClick={() =>
                        run(u.id, () =>
                          banUserAction({
                            data: { userId: u.id, ban: !u.banned },
                          }),
                        )
                      }
                    >
                      {u.banned ? (
                        <UserCheck className="size-4" />
                      ) : (
                        <Ban className="size-4" />
                      )}
                      {u.banned ? "Unban" : "Ban"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
