import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (singleton) for client components. */
export function createSupabaseBrowserClient() {
  if (client) return client;
  client = createBrowserClient(supabaseUrl(), supabasePublishableKey());
  return client;
}
