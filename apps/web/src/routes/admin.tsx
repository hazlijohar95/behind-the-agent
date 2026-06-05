import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@btc/ui/components/sidebar";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AccountMenuClient } from "@/components/account-menu-client";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { monetizationEnabled } from "@/lib/entitlements";
import { getCurrentUser, isAdmin } from "@/lib/session";

const loadAdminLayout = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: "/admin" } });
  }
  if (!isAdmin(user)) {
    throw redirect({ to: "/" });
  }
  return {
    monetizationEnabled,
    user: {
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      role: user.role ?? "user",
    },
  };
});

export const Route = createFileRoute("/admin")({
  beforeLoad: () => loadAdminLayout(),
  loader: ({ context }) => ({
    monetizationEnabled: context.monetizationEnabled,
    user: context.user,
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { monetizationEnabled, user } = Route.useLoaderData();

  return (
    <SidebarProvider defaultOpen={false}>
      <AdminSidebar monetizationEnabled={monetizationEnabled} />
      <SidebarInset className="[--card:oklch(0.985_0_0)] dark:[--card:oklch(0.16_0_0)]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-glass-border bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-2">
            <AccountMenuClient
              name={user.name}
              email={user.email}
              image={user.image}
              role={user.role}
            />
          </div>
        </header>
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
