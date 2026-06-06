import type { Certificate } from "@btc/db";

/**
 * Server-only certificate renderer.
 *
 * Renders a completion certificate as a self-contained SVG string — pure
 * string templating with no external renderer, so it runs anywhere (Cloudflare
 * Workers included) with zero cold-start cost and no WASM/Node dependency.
 *
 * Why SVG and not satori + resvg-wasm (the original design): those packages
 * aren't available to install in this environment, and PNG rasterization on
 * Workers is the riskiest part of the design (WASM init + CPU budget). A
 * standalone SVG is a real, shareable, infinitely-crisp image that embeds fine
 * in <img>, OG/Twitter cards, and downloads — and it sidesteps that risk
 * entirely. PNG output (via @resvg/resvg-wasm) is a deferred enhancement; see
 * {@link renderCertificatePng}.
 *
 * SECURITY: every dynamic field (recipient name, course title, serial) is
 * XML-escaped before interpolation — a course/profile name is user-controlled
 * upstream, so unescaped text would be an SVG/XML injection sink.
 */

const WIDTH = 1200;
const HEIGHT = 800;

/** Escape text for safe interpolation into SVG/XML text + attribute contexts. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatIssuedDate(issuedAt: number): string {
  if (!issuedAt) return "";
  return new Date(issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Render a certificate as an SVG document string. Deterministic and pure — the
 * same certificate always renders identically, which is why the image route can
 * cache it immutably (an issued certificate's fields are snapshotted in-DB).
 */
export function renderCertificateSvg(cert: Certificate): string {
  const recipient = escapeXml(cert.recipientName || "A learner");
  const title = escapeXml(cert.courseTitle || "this course");
  const serial = escapeXml(cert.serial);
  const issued = escapeXml(formatIssuedDate(cert.issuedAt));

  // System font stack only — no embedded font, so this stays dependency-free
  // and small. (A subsetted woff would be required if we later rasterize to PNG
  // with resvg, which can't use system fonts.)
  const sans =
    "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Certificate of completion for ${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0b0f"/>
      <stop offset="100%" stop-color="#15131f"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="32" y="32" width="${WIDTH - 64}" height="${HEIGHT - 64}" rx="20"
        fill="none" stroke="#2a2735" stroke-width="2"/>
  <rect x="32" y="32" width="${WIDTH - 64}" height="6" rx="3" fill="url(#accent)"/>

  <text x="${WIDTH / 2}" y="180" text-anchor="middle" fill="#a8a5b8"
        font-family="${sans}" font-size="22" letter-spacing="6"
        text-transform="uppercase">CERTIFICATE OF COMPLETION</text>

  <text x="${WIDTH / 2}" y="250" text-anchor="middle" fill="#6f6c80"
        font-family="${sans}" font-size="20">This is to certify that</text>

  <text x="${WIDTH / 2}" y="350" text-anchor="middle" fill="#ffffff"
        font-family="${sans}" font-size="56" font-weight="700">${recipient}</text>

  <text x="${WIDTH / 2}" y="420" text-anchor="middle" fill="#6f6c80"
        font-family="${sans}" font-size="20">has successfully completed</text>

  <text x="${WIDTH / 2}" y="490" text-anchor="middle" fill="#c4b5fd"
        font-family="${sans}" font-size="36" font-weight="600">${title}</text>

  <line x1="${WIDTH / 2 - 220}" y1="640" x2="${WIDTH / 2 + 220}" y2="640"
        stroke="#2a2735" stroke-width="1"/>

  <text x="${WIDTH / 2}" y="690" text-anchor="middle" fill="#a8a5b8"
        font-family="${sans}" font-size="18">${issued}</text>
  <text x="${WIDTH / 2}" y="720" text-anchor="middle" fill="#6f6c80"
        font-family="${sans}" font-size="15" letter-spacing="2">Serial ${serial}</text>
</svg>`;
}

/** MIME type for {@link renderCertificateSvg} output. */
export const CERTIFICATE_SVG_CONTENT_TYPE = "image/svg+xml; charset=utf-8";

/**
 * Rasterize a certificate to PNG. NOT YET IMPLEMENTED: requires
 * `@resvg/resvg-wasm` (the WASM build — the native `@resvg/resvg-js` won't run
 * on Workers) plus an embedded subsetted font, neither of which is installable
 * here. The SVG endpoint already serves a fully shareable image; PNG is a
 * follow-up. Kept as an explicit, throwing stub so callers fail loudly rather
 * than silently shipping an empty image if wired prematurely.
 */
export function renderCertificatePng(_cert: Certificate): never {
  throw new Error(
    "PNG certificate rendering is not implemented — add @resvg/resvg-wasm and an embedded font, then rasterize renderCertificateSvg(). The SVG endpoint serves a shareable image in the meantime.",
  );
}
