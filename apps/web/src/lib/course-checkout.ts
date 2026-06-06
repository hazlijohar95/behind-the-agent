import { CheckoutError } from "./billing-client";

/**
 * Start a Polar checkout to buy a single course. Resolves to the hosted
 * checkout URL, or throws {@link CheckoutError} (carrying the HTTP status) so
 * the caller can branch its UX — e.g. redirect to /login on 401. Mirrors
 * `startCheckout` in billing-client, kept separate because the course buy flow
 * posts to its own endpoint (`/api/course-checkout`).
 */
export async function startCourseCheckout(courseId: string): Promise<string> {
  const res = await fetch("/api/course-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId }),
  });
  if (!res.ok) throw new CheckoutError(res.status);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new CheckoutError(res.status);
  return data.url;
}
