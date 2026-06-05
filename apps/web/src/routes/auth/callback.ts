import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth + magic-link callback. Exchanges the `code` for a session (the
 * @supabase/ssr client persists it to cookies), then redirects to `next`.
 */
export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchParams, origin } = new URL(request.url);
        const code = searchParams.get("code");
        const next = searchParams.get("next") ?? "/";

        if (code) {
          const supabase = createSupabaseServerClient();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            return Response.redirect(`${origin}${next}`);
          }
        }

        return Response.redirect(`${origin}/login?error=auth`);
      },
    },
  },
});
