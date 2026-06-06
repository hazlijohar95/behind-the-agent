import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@btc/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import {
  CreditCard,
  FolderTree,
  GraduationCap,
  Home,
  LayoutDashboard,
  MessageSquare,
  Rocket,
  Settings,
  Upload,
  Users,
  Video,
} from "lucide-react";
import type { ComponentType } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/videos/new", label: "Upload", icon: Upload },
  { href: "/admin/courses", label: "Courses", icon: GraduationCap },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/comments", label: "Comments", icon: MessageSquare },
  { href: "/admin/users", label: "Users", icon: Users },
];

const SETTINGS_NAV: NavItem[] = [
  { href: "/admin/plans", label: "Monetization", icon: CreditCard },
  { href: "/admin/setup", label: "Setup", icon: Rocket },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({
  monetizationEnabled,
}: {
  monetizationEnabled: boolean;
}) {
  const pathname = useLocation().pathname;

  const settingsNav = monetizationEnabled
    ? SETTINGS_NAV
    : SETTINGS_NAV.filter((i) => i.href !== "/admin/plans");

  // Pick the single most-specific matching item so only one entry is active
  // (e.g. /admin/videos/new highlights "Upload", not "Videos").
  const matches = (href: string, exact?: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const activeHref = [...NAV, ...settingsNav]
    .filter((i) => matches(i.href, i.exact))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const isActive = (href: string) => href === activeHref;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Configure</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to site">
              <Link to="/">
                <Home />
                <span>Back to site</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
