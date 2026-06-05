import { Polar } from "@polar-sh/sdk";

let client: Polar | null = null;

export function getPolar(): Polar {
  if (client) return client;
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) throw new Error("POLAR_ACCESS_TOKEN is not configured.");
  client = new Polar({
    accessToken,
    server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
  });
  return client;
}

// Canonical app-URL helper lives in @/lib/env; re-exported here for the Polar
// checkout call sites that build redirect URLs.
export { appUrl } from "@/lib/env";
