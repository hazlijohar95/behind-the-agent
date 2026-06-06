import { coercePublishStatus, courseRepo, type PublishStatus } from "@btc/db";
import { formatRelativeTime } from "@btc/ui";
import { Badge } from "@btc/ui/components/badge";
import { Button } from "@btc/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@btc/ui/components/table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/session";

const STATUS_VARIANT: Record<
  PublishStatus,
  "default" | "secondary" | "outline"
> = {
  published: "default",
  scheduled: "secondary",
  draft: "outline",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "scheduled", label: "Scheduled" },
] as const;

const loadAdminCourses = createServerFn({ method: "GET" })
  .inputValidator((input: { status: unknown; q?: unknown }) => ({
    status: coercePublishStatus(input.status),
    q: typeof input.q === "string" ? input.q : undefined,
  }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const page = await courseRepo.listAdminCourses({
      status: data.status,
      query: data.q,
      limit: 100,
    });
    return { page };
  });

export const Route = createFileRoute("/admin/courses/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { status?: string; q?: string } => ({
    status: typeof search.status === "string" ? search.status : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ status: search.status ?? "all", q: search.q }),
  loader: ({ deps }) => loadAdminCourses({ data: deps }),
  component: AdminCoursesPage,
});

function AdminCoursesPage() {
  const { page } = Route.useLoaderData();
  const { status } = Route.useSearch();
  const active = status ?? "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Courses
        </h1>
        <Button asChild variant="gradient">
          <Link to="/admin/courses/new">
            <Plus className="size-4" /> New course
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-1 rounded-full border border-glass-border bg-secondary/40 p-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            to="/admin/courses"
            search={{ status: f.key }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              active === f.key
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Access</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  No courses yet. Create your first course.
                </TableCell>
              </TableRow>
            )}
            {page.items.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    to="/admin/courses/$id"
                    params={{ id: c.id }}
                    className="font-medium hover:text-primary"
                  >
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[c.publishStatus]}
                    className="capitalize"
                  >
                    {c.publishStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {c.access}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatRelativeTime(c.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
