import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@btc/ui/components/card";
import { Link } from "@tanstack/react-router";
import { Award } from "lucide-react";
import type { EarnedCertificate } from "./types";

/** Earned certificates, each linking to its public `/cert/$serial` page. */
export function CertificatesCard({
  certificates,
}: {
  certificates: EarnedCertificate[];
}) {
  if (certificates.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="size-5" /> Certificates
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {certificates.map((cert) => (
          <Link
            key={cert.serial}
            to="/cert/$serial"
            params={{ serial: cert.serial }}
            className="flex items-center justify-between py-2.5 text-sm hover:text-primary"
          >
            <span>{cert.courseTitle}</span>
            <span className="text-muted-foreground">
              {cert.issuedAt > 0
                ? new Date(cert.issuedAt).toLocaleDateString()
                : ""}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
