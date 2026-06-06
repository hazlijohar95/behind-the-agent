import { appUrl, serverEnv } from "@/lib/env";

/**
 * Transactional email via Resend.
 *
 * The provider is operator-configured: both RESEND_API_KEY and EMAIL_FROM are
 * read lazily from {@link serverEnv} per call (never cached at module scope — the
 * Workers runtime only populates secrets per request). When either is unset the
 * platform simply runs without email: {@link sendEmail} no-ops gracefully and
 * returns `{ sent: false }` so callers can branch without try/catch noise.
 */

export type SendResult = { sent: boolean };

type EmailConfig = { apiKey: string; from: string };

/** Resolve the email provider config, or `null` when not operator-configured. */
function emailConfig(): EmailConfig | null {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();
  if (!RESEND_API_KEY || !EMAIL_FROM) return null;
  return { apiKey: RESEND_API_KEY, from: EMAIL_FROM };
}

/** True when transactional email is configured and will actually be delivered. */
export function isEmailConfigured(): boolean {
  return emailConfig() !== null;
}

/**
 * Send one transactional email. No-ops (returns `{ sent: false }`) when the
 * provider is unconfigured. Network/provider failures are logged and swallowed —
 * a failed receipt must never break the webhook or cron flow that triggered it,
 * and webhook idempotency means we never retry an already-processed event.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const config = emailConfig();
  if (!config) {
    console.warn(
      "[email] RESEND_API_KEY/EMAIL_FROM not set; skipping email:",
      opts.subject,
    );
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend request failed:", err);
    return { sent: false };
  }
}

/* ─────────────────────────── shared layout ─────────────────────────── */

const BRAND = "Behind The Agents";
const ACCENT = "#8b5cf6";

/** Escape user-supplied text before interpolating it into an HTML email. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wrap body markup in the shared, inline-styled email shell. */
function layout(opts: { heading: string; body: string }): string {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin:0 0 16px;font-size:20px">${esc(opts.heading)}</h2>
      ${opts.body}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px" />
      <p style="color:#999;font-size:12px;margin:0">${esc(BRAND)}</p>
    </div>`;
}

/** A primary call-to-action button. `href` must already be a trusted URL. */
function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${ACCENT};color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${esc(label)}</a>`;
}

/**
 * Format a minor-unit amount (e.g. cents) + ISO currency code for display.
 * Falls back to a plain `code amount` string for currencies Intl can't format.
 */
function formatMoney(amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(major);
  } catch {
    return `${code} ${major.toFixed(2)}`;
  }
}

/* ─────────────────────────── auth ─────────────────────────── */

export function magicLinkEmail(url: string): { subject: string; html: string } {
  return {
    subject: `Sign in to ${BRAND}`,
    html: layout({
      heading: `Sign in to ${BRAND}`,
      body: `
        <p style="color:#555;margin:0 0 20px">Click the button below to sign in. This link expires shortly.</p>
        ${button(url, "Sign in")}
        <p style="color:#999;font-size:13px;margin-top:20px">If you didn't request this, you can ignore this email.</p>`,
    }),
  };
}

/* ─────────────────────── transactional templates ─────────────────────── */

/** Receipt for a one-off video purchase (Polar `order.paid`). */
export function purchaseReceiptEmail(opts: {
  videoTitle: string;
  videoUrl: string;
  amountMinor: number;
  currency: string;
}): { subject: string; html: string } {
  const price = formatMoney(opts.amountMinor, opts.currency);
  return {
    subject: `Your receipt for "${opts.videoTitle}"`,
    html: layout({
      heading: "Thanks for your purchase",
      body: `
        <p style="color:#555;margin:0 0 8px">You now have lifetime access to:</p>
        <p style="margin:0 0 4px;font-weight:600;font-size:16px">${esc(opts.videoTitle)}</p>
        <p style="color:#555;margin:0 0 20px">Amount charged: <strong>${esc(price)}</strong></p>
        ${button(opts.videoUrl, "Watch now")}`,
    }),
  };
}

/** Confirmation that a subscription renewed / became active. */
export function subscriptionRenewalEmail(opts: {
  planName: string;
  periodEnd: number | null; // unix seconds
}): { subject: string; html: string } {
  const renews =
    opts.periodEnd != null
      ? new Date(opts.periodEnd * 1000).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
  return {
    subject: `Your ${BRAND} subscription is active`,
    html: layout({
      heading: "Subscription active",
      body: `
        <p style="color:#555;margin:0 0 8px">Your <strong>${esc(opts.planName)}</strong> plan is active and you have full access to subscriber content.</p>
        ${renews ? `<p style="color:#555;margin:0 0 20px">Next renewal: <strong>${esc(renews)}</strong></p>` : `<p style="margin:0 0 20px"></p>`}
        ${button(`${appUrl()}/`, "Browse videos")}`,
    }),
  };
}

/** Dunning notice when a subscription payment fails / goes past due. */
export function failedPaymentEmail(opts: { planName: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `Action needed: payment failed for your ${BRAND} subscription`,
    html: layout({
      heading: "We couldn't process your payment",
      body: `
        <p style="color:#555;margin:0 0 8px">Your latest payment for the <strong>${esc(opts.planName)}</strong> plan didn't go through, so your subscriber access is at risk.</p>
        <p style="color:#555;margin:0 0 20px">Please update your payment method to keep your access.</p>
        ${button(`${appUrl()}/account`, "Update billing")}`,
    }),
  };
}

/** Notification that a new video was just published. */
export function newVideoEmail(opts: { videoTitle: string; videoUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `New on ${BRAND}: ${opts.videoTitle}`,
    html: layout({
      heading: "New video published",
      body: `
        <p style="color:#555;margin:0 0 8px">A new video is live:</p>
        <p style="margin:0 0 20px;font-weight:600;font-size:16px">${esc(opts.videoTitle)}</p>
        ${button(opts.videoUrl, "Watch now")}`,
    }),
  };
}

/** Notification that a new course was just published. */
export function newCourseEmail(opts: {
  courseTitle: string;
  courseUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `New on ${BRAND}: ${opts.courseTitle}`,
    html: layout({
      heading: "New course published",
      body: `
        <p style="color:#555;margin:0 0 8px">A new course is live:</p>
        <p style="margin:0 0 20px;font-weight:600;font-size:16px">${esc(opts.courseTitle)}</p>
        ${button(opts.courseUrl, "Start learning")}`,
    }),
  };
}
