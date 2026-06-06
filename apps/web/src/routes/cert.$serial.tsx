import { certificateRepo, rateLimiters } from "@btc/db";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { cfClientIp } from "@/lib/cert-ratelimit";
import { appUrl } from "@/lib/env";

/**
 * Public certificate verify + view page: `/cert/$serial`.
 *
 * No auth — a certificate is meant to be shared and independently verified by
 * anyone holding its serial. The loader looks the serial up (404 on miss) and
 * the page renders the snapshotted recipient/course/date alongside the
 * certificate image and a "verified" badge. OG/Twitter meta point at the SVG
 * image endpoint for rich link unfurls.
 *
 * M2: a public, unauthenticated serial lookup is an online oracle. Serials are
 * 80-bit random tokens, but we still IP-rate-limit (keyed off the trusted
 * CF-Connecting-IP) to cap brute-force guessing, and FAIL CLOSED (429) on a DB
 * blip — same limiter the SVG endpoint uses.
 */
const loadCertificate = createServerFn({ method: "GET" })
  .inputValidator((input: { serial: string }) => input)
  .handler(async ({ data: { serial } }) => {
    const { success } = await rateLimiters
      .cert()
      .limit(cfClientIp(getRequest()));
    if (!success) {
      throw new Response("Too many requests", { status: 429 });
    }
    const cert = await certificateRepo.getCertificateBySerial(serial);
    if (!cert) throw notFound();
    return {
      serial: cert.serial,
      recipientName: cert.recipientName || "A learner",
      courseTitle: cert.courseTitle || "this course",
      issuedAt: cert.issuedAt,
    };
  });

export const Route = createFileRoute("/cert/$serial")({
  loader: ({ params }) => loadCertificate({ data: { serial: params.serial } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { serial, recipientName, courseTitle } = loaderData;
    const title = `${recipientName} — ${courseTitle}`;
    const description = `Verified certificate of completion for ${courseTitle}. Serial ${serial}.`;
    const image = `${appUrl()}/api/cert/${serial}.svg`;
    return {
      meta: [
        { title: `Certificate · ${courseTitle}` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: CertificatePage,
});

function formatDate(issuedAt: number): string {
  if (!issuedAt) return "";
  return new Date(issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CertificatePage() {
  const { serial, recipientName, courseTitle, issuedAt } =
    Route.useLoaderData();
  const imageSrc = `/api/cert/${serial}.svg`;

  return (
    <div className="min-h-screen bg-btc-bg font-sans text-btc-text antialiased">
      <main className="mx-auto flex w-full max-w-[900px] flex-col items-center gap-8 px-4 py-16 sm:px-8">
        <div className="flex items-center gap-2 rounded-full border border-btc-border bg-btc-surface px-4 py-1.5 text-[13px] font-medium text-btc-muted">
          <span aria-hidden className="size-2 rounded-full bg-emerald-400" />
          Verified certificate
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-btc-border bg-black">
          {/* The SVG endpoint is the canonical, shareable artifact. */}
          <img
            src={imageSrc}
            alt={`Certificate of completion for ${courseTitle}`}
            className="block w-full"
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[22px] font-medium text-btc-text">
            {recipientName}
          </p>
          <p className="text-[15px] text-btc-muted">
            completed <span className="text-btc-text">{courseTitle}</span>
          </p>
          {issuedAt > 0 && (
            <p className="text-[13px] text-btc-muted">
              Issued {formatDate(issuedAt)}
            </p>
          )}
          <p className="mt-2 font-mono text-[12px] tracking-wide text-btc-muted">
            Serial {serial}
          </p>
        </div>

        <a
          href={imageSrc}
          download={`certificate-${serial}.svg`}
          className="rounded-full border border-btc-border bg-btc-surface px-5 py-2 text-[14px] font-medium text-btc-text transition-colors hover:bg-btc-bg"
        >
          Download certificate
        </a>
      </main>
    </div>
  );
}
