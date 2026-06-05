import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Cookie-bound Supabase client for loaders, server functions and server routes.
 * Reads the user's session from the request cookies via TanStack Start's
 * getCookies/setCookie. When getClaims()/getUser() rotates the access token,
 * setAll writes the refreshed cookies onto the response.
 */
export function createSupabaseServerClient() {
  // Resolved lazily (per request) — see @/lib/env for why env must never be read
  // at module top-level on the Workers runtime. Same public URL/key as the client.
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
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
