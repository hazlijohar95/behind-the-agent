import { toast } from "@btc/ui/components/toaster";
import { useRouter } from "@tanstack/react-router";
import * as React from "react";

type RunOptions = {
  success?: string;
  error?: string;
  /** Runs after the action succeeds, before the router invalidate (e.g. reset a form). */
  onSuccess?: () => void;
};

function isFailure(result: unknown): result is { ok: false; error?: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    (result as { ok: unknown }).ok === false
  );
}

/**
 * Standardises the optimistic-action plumbing repeated across admin managers:
 * busy tracking, error/success toasts, and a `router.invalidate()` on success.
 *
 * `run(id, fn, opts)` runs `fn`; `id` lets a list disable just the acting row
 * via `busyId === id`. It understands the server-fn `{ ok, error }` convention
 * (a falsy `ok` becomes a thrown error) as well as functions that throw.
 */
export function useAction() {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (id: string, fn: () => Promise<unknown>, opts: RunOptions = {}) => {
      setBusyId(id);
      try {
        const result = await fn();
        if (isFailure(result)) {
          throw new Error(result.error ?? opts.error ?? "Action failed");
        }
        opts.onSuccess?.();
        if (opts.success) toast.success(opts.success);
        router.invalidate();
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : opts.error;
        toast.error(message ?? "Action failed");
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  return { busyId, busy: busyId !== null, run };
}
