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

export function appUrl(): string {
  return (process.env.VITE_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
