import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

/** Shown while a route loader is in flight (router defaultPendingComponent). */
export function RouteSpinner() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/** Branded 404 (root notFoundComponent). */
export function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="space-y-3">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="font-serif text-3xl tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          That page doesn&apos;t exist or has moved.
        </p>
        <Link
          to="/"
          className="inline-block pt-2 text-sm font-medium text-primary hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </div>
  );
}

/** Branded error boundary (root errorComponent). */
export function RouteError({ error }: { error: Error }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="space-y-3">
        <h1 className="font-serif text-3xl tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground">An unexpected error occurred.</p>
        {import.meta.env.DEV && (
          <pre className="mx-auto max-w-lg overflow-auto rounded-lg bg-secondary/50 p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
        <Link
          to="/"
          className="inline-block pt-2 text-sm font-medium text-primary hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </div>
  );
}
