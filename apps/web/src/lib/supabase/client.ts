import { createBrowserClient } from "@supabase/ssr";

// Vite exposes only VITE_-prefixed vars to the browser (replaces NEXT_PUBLIC_).
const url = import.meta.env.VITE_SUPABASE_URL as string;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (singleton) for client components. */
export function createSupabaseBrowserClient() {
  if (client) return client;
  client = createBrowserClient(url, publishableKey);
  return client;
}
