import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

// Server-side these are read from process.env (populated from Worker vars /
// .dev.vars via nodejs_compat). Same publishable URL/key used on the client.
const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "";

/**
 * Cookie-bound Supabase client for loaders, server functions and server routes.
 * Reads the user's session from the request cookies (TanStack Start) instead of
 * next/headers. When getClaims()/getUser() rotates the access token, setAll
 * writes the refreshed cookies onto the response.
 */
export function createSupabaseServerClient() {
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options);
        }
      },
    },
  });
}
