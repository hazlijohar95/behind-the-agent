import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  UserManagement,
  type UserRow,
} from "@/components/admin/user-management";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";

const loadUsers = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireAdmin();

  let users: UserRow[] = [];
  try {
    users = await listUsers(200);
  } catch {
    users = [];
  }

  return { users, currentUserId: me?.id ?? "" };
});

export const Route = createFileRoute("/admin/users")({
  loader: () => loadUsers(),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { users, currentUserId } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage roles and access. The first user to sign up is an admin.
        </p>
      </div>
      <UserManagement users={users} currentUserId={currentUserId} />
    </div>
  );
}
