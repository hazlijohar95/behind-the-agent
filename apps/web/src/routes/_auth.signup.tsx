import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthForm } from "@/components/auth-form";
import { getAuthMethods } from "@/lib/auth-methods";

const loadAuthMethods = createServerFn({ method: "GET" }).handler(async () =>
  getAuthMethods(),
);

export const Route = createFileRoute("/_auth/signup")({
  loader: () => loadAuthMethods(),
  head: () => ({ meta: [{ title: "Create account" }] }),
  component: SignupPage,
});

function SignupPage() {
  const methods = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-btc-text">
          Create your account
        </h1>
        <p className="text-sm text-btc-muted">
          Join to like, comment, and follow along.
        </p>
      </div>
      <AuthForm mode="signup" methods={methods} />
    </div>
  );
}
