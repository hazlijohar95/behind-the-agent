/**
 * Client-side helpers for the Polar billing endpoints. Each returns the hosted
 * URL to redirect to, or throws `CheckoutError` (carrying the HTTP status) so
 * callers can decide their own UX (toast, redirect to /login on 401, etc.).
 */

export class CheckoutError extends Error {
  constructor(readonly status: number) {
    super(`Billing request failed (${status})`);
    this.name = "CheckoutError";
  }
}

async function postForUrl(path: string, body?: unknown): Promise<string> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new CheckoutError(res.status);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new CheckoutError(res.status);
  return data.url;
}

export type CheckoutInput =
  | { mode: "subscription"; planId?: string }
  | { mode: "purchase"; videoId: string };

/** Start a Polar checkout; resolves to the hosted checkout URL. */
export const startCheckout = (input: CheckoutInput): Promise<string> =>
  postForUrl("/api/polar/checkout", input);

/** Open the Polar customer portal; resolves to its URL. */
export const openBillingPortal = (): Promise<string> =>
  postForUrl("/api/polar/portal");
