import {
  courseRepo,
  planRepo,
  profileRepo,
  purchaseRepo,
  videoRepo,
  webhookRepo,
} from "@btc/db";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/api";
import { getUserIdByCustomer, setBilling } from "@/lib/billing";
import {
  failedPaymentEmail,
  isEmailConfigured,
  purchaseReceiptEmail,
  sendEmail,
  subscriptionRenewalEmail,
} from "@/lib/email";
import { appUrl } from "@/lib/env";

type PolarEvent = ReturnType<typeof validateEvent>;
type OrderData = Extract<PolarEvent, { type: "order.paid" }>["data"];
type SubscriptionData = Extract<
  PolarEvent,
  { type: "subscription.updated" }
>["data"];

/** What {@link syncSubscription} resolved, so the caller can decide on email. */
type SubscriptionSync = {
  userId: string;
  planName: string;
  status: string;
  periodEnd: number | null;
};

async function syncSubscription(
  sub: SubscriptionData,
): Promise<SubscriptionSync | null> {
  const customerId = sub.customerId;
  const userId =
    sub.customer?.externalId ??
    (sub.metadata?.userId != null ? String(sub.metadata.userId) : null) ??
    (await getUserIdByCustomer(customerId));
  if (!userId) return null;

  const plan = sub.productId
    ? await planRepo.findPlanByProductId(sub.productId)
    : null;
  const periodEnd = sub.currentPeriodEnd
    ? Math.floor(new Date(sub.currentPeriodEnd).getTime() / 1000)
    : null;

  await setBilling({
    userId,
    polarCustomerId: customerId,
    status: sub.status,
    planId:
      plan?.id ??
      (sub.metadata?.planId != null ? String(sub.metadata.planId) : null),
    currentPeriodEnd: periodEnd,
    updatedAt: Date.now(),
  });

  return {
    userId,
    planName: plan?.name ?? "subscription",
    status: sub.status,
    periodEnd,
  };
}

/** Look up a member's email from our own profiles store (repository-backed). */
async function emailFor(userId: string): Promise<string | null> {
  const profile = await profileRepo.getProfile(userId);
  return profile?.email ? profile.email : null;
}

/**
 * Email a purchase receipt for a completed video order. Best-effort: a missing
 * profile/video/email simply skips the send, and any failure is swallowed by
 * {@link sendEmail} so it can never fail the webhook (which would make Polar
 * retry an event we've already recorded as processed).
 */
async function sendPurchaseReceipt(
  order: OrderData,
  userId: string,
  videoId: string,
): Promise<void> {
  if (!isEmailConfigured()) return;
  const [to, video] = await Promise.all([
    emailFor(userId),
    videoRepo.getVideo(videoId),
  ]);
  if (!to || !video) return;
  const { subject, html } = purchaseReceiptEmail({
    videoTitle: video.title,
    videoUrl: `${appUrl()}/v/${video.slug}`,
    amountMinor: order.totalAmount ?? 0,
    currency: order.currency ?? "usd",
  });
  await sendEmail({ to, subject, html });
}

/**
 * Send the right subscription email for a sync result: a dunning notice when the
 * subscription is past due / unpaid, otherwise an "active" confirmation when it
 * is in good standing. No-ops when email is unconfigured.
 */
async function sendSubscriptionEmail(sync: SubscriptionSync): Promise<void> {
  if (!isEmailConfigured()) return;
  const to = await emailFor(sync.userId);
  if (!to) return;

  const pastDue = sync.status === "past_due" || sync.status === "unpaid";
  const { subject, html } = pastDue
    ? failedPaymentEmail({ planName: sync.planName })
    : sync.status === "active" || sync.status === "trialing"
      ? subscriptionRenewalEmail({
          planName: sync.planName,
          periodEnd: sync.periodEnd,
        })
      : { subject: "", html: "" };

  if (!subject) return; // canceled/revoked etc. — no email for this transition.
  await sendEmail({ to, subject, html });
}

export const Route = createFileRoute("/api/polar/webhook")({
  server: {
    handlers: {
      POST: async ({ request: req }) => {
        const secret = process.env.POLAR_WEBHOOK_SECRET;
        if (!secret) return json({ error: "Webhook not configured" }, 501);

        const body = await req.text();
        const headers = {
          "webhook-id": req.headers.get("webhook-id") ?? "",
          "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
          "webhook-signature": req.headers.get("webhook-signature") ?? "",
        };

        let event: PolarEvent;
        try {
          event = validateEvent(body, headers, secret);
        } catch (err) {
          if (err instanceof WebhookVerificationError)
            return json({ error: "Invalid signature" }, 403);
          return json({ error: "Invalid payload" }, 400);
        }

        // Standard-webhooks delivery id makes each delivery idempotent.
        const deliveryId =
          headers["webhook-id"] || `${event.type}:${event.data.id ?? ""}`;
        const fresh = await webhookRepo.markProcessed("polar", deliveryId);
        if (!fresh) return json({ ok: true, deduped: true });

        try {
          switch (event.type) {
            case "order.paid": {
              const order = event.data;
              const meta = order.metadata ?? {};
              if (meta.kind === "purchase" && meta.userId && meta.videoId) {
                const userId = String(meta.userId);
                const videoId = String(meta.videoId);
                await purchaseRepo.recordPurchase({
                  userId,
                  videoId,
                  polarOrderId: order.id,
                  amount: order.totalAmount ?? 0,
                  currency: order.currency ?? "usd",
                });
                // Receipt is best-effort: never let an email problem fail the
                // webhook, since the delivery is already marked processed and
                // Polar would not retry it.
                await sendPurchaseReceipt(order, userId, videoId).catch((err) =>
                  console.error("[polar webhook] receipt email failed:", err),
                );
              } else if (
                meta.kind === "course-purchase" &&
                meta.userId &&
                meta.courseId
              ) {
                // Course one-time purchase (started by /api/course-checkout).
                // Records the course entitlement read by resolveCourseAccess.
                await courseRepo.recordCoursePurchase({
                  userId: String(meta.userId),
                  courseId: String(meta.courseId),
                  polarOrderId: order.id,
                  amount: order.totalAmount ?? 0,
                  currency: order.currency ?? "usd",
                });
              }
              break;
            }

            case "subscription.created":
            case "subscription.updated":
            case "subscription.active":
            case "subscription.canceled":
            case "subscription.revoked": {
              const sync = await syncSubscription(event.data);
              if (sync) {
                await sendSubscriptionEmail(sync).catch((err) =>
                  console.error(
                    "[polar webhook] subscription email failed:",
                    err,
                  ),
                );
              }
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error("[polar webhook] handler error:", err);
          return json({ error: "Handler error" }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});
