import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthForm } from "@/components/auth-form";
import { BrandWordmark } from "@/components/home/landing";
import { getAuthMethods } from "@/lib/auth-methods";

const loadAuthMethods = createServerFn({ method: "GET" }).handler(async () =>
  getAuthMethods(),
);

export const Route = createFileRoute("/_auth/login")({
  loader: () => loadAuthMethods(),
  head: () => ({ meta: [{ title: "Sign in" }] }),
  component: LoginPage,
});

function LoginPage() {
  const methods = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div className="flex justify-center text-center">
        <BrandWordmark className="text-2xl" />
      </div>
      <AuthForm mode="login" methods={methods} />
    </div>
  );
}
