import { courseRepo } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authedRoute, json } from "@/lib/api";
import { monetizationEnabled } from "@/lib/entitlements";
import { appUrl, getPolar } from "@/lib/polar";

/**
 * Start a Polar checkout to buy a single course (one-time purchase).
 *
 * Mirrors the video-purchase branch of `/api/polar/checkout`, but for a course:
 * the checkout's metadata carries `kind: "course-purchase"` + `courseId`, which
 * the Polar webhook (`order.paid`) reads to record the course entitlement
 * (course_purchases). Access is then granted by
 * `resolveCourseAccess`/`hasPurchasedCourse`.
 *
 * Auth + error handling reuse the shared `authedRoute` helper (401/403 + clean
 * 500). Only purchasable courses (published is not required — a buyer reaching
 * here already has the slug — but `access === "purchase"` and a Polar product
 * are) can be bought.
 */
const bodySchema = z.object({ courseId: z.string().min(1) });

export const Route = createFileRoute("/api/course-checkout")({
  server: {
    handlers: {
      POST: authedRoute("user", async ({ request, user }) => {
        if (!monetizationEnabled())
          return json({ error: "Monetization is disabled" }, 501);

        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const course = await courseRepo.getCourse(payload.courseId);
        if (!course) return json({ error: "Course not found" }, 404);
        if (course.access !== "purchase" || !course.polarProductId)
          return json({ error: "This course isn't available to buy" }, 400);

        try {
          const checkout = await getPolar().checkouts.create({
            products: [course.polarProductId],
            externalCustomerId: user.id,
            customerEmail: user.email,
            successUrl: `${appUrl()}/course/${course.slug}?purchase=success`,
            metadata: {
              userId: user.id,
              courseId: course.id,
              kind: "course-purchase",
            },
          });
          return json({ url: checkout.url });
        } catch (err) {
          console.error("[course checkout]", err);
          return json({ error: "Could not start checkout" }, 500);
        }
      }),
    },
  },
});
