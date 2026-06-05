import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { RouteSpinner } from "@/components/route-states";
import { routeTree } from "./routeTree.gen";

// TanStack Start calls this to create a fresh router instance per request (SSR)
// and once on the client.
export function getRouter() {
  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    // Cache loader results in-router for 60s across client navigations;
    // router.invalidate() (used after admin mutations) bypasses it. Public
    // catalog pages additionally set edge Cache-Control via cachePublic().
    defaultStaleTime: 1000 * 60,
    // Smooth animated route changes; browsers without the View Transitions API
    // navigate normally.
    defaultViewTransition: true,
    // Show a spinner if a loader runs longer than 200ms.
    defaultPendingComponent: RouteSpinner,
    defaultPendingMs: 200,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
