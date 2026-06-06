import { certificateRepo, rateLimiters } from "@btc/db";
import { createFileRoute } from "@tanstack/react-router";
import { apiRoute } from "@/lib/api";
import { cfClientIp } from "@/lib/cert-ratelimit";
import {
  CERTIFICATE_SVG_CONTENT_TYPE,
  renderCertificateSvg,
} from "@/lib/certificate";

/**
 * Certificate image: `GET /api/cert/$serial.svg`.
 *
 * Public (no auth) so an issued certificate is shareable/embeddable — it's the
 * image behind the verify page's OG/Twitter card and the download button. An
 * issued certificate never changes (its display fields are snapshotted in-DB),
 * so the SVG is deterministic and cached immutably.
 *
 * Returns 404 for an unknown serial. Serials are random 80-bit tokens, so they
 * aren't feasibly enumerable; exposing only the snapshotted name/title (the
 * fields meant to appear on the certificate) is intended for verification.
 *
 * M2: this is a public, unauthenticated lookup — an online oracle. Even with
 * 80-bit serials we IP-rate-limit (keyed off the trusted CF-Connecting-IP) to
 * cap guess volume, and FAIL CLOSED (429) on a DB blip.
 */
export const Route = createFileRoute("/api/cert/$serial.svg")({
  server: {
    handlers: {
      GET: apiRoute<{ serial: string }>(async ({ request, params }) => {
        const { success } = await rateLimiters
          .cert()
          .limit(cfClientIp(request));
        if (!success) {
          return new Response("Too many requests", { status: 429 });
        }
        const cert = await certificateRepo.getCertificateBySerial(
          params.serial,
        );
        if (!cert) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(renderCertificateSvg(cert), {
          headers: {
            "content-type": CERTIFICATE_SVG_CONTENT_TYPE,
            "cache-control": "public, max-age=86400, immutable",
          },
        });
      }),
    },
  },
});
