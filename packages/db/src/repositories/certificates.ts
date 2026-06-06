import { getDb } from "../client";
import type { Database } from "../database.types";
import type { Certificate } from "../types";

type CertificateRow = Database["public"]["Tables"]["certificates"]["Row"];

function toMs(ts: string | null): number | null {
  return ts ? new Date(ts).getTime() : null;
}

export function rowToCertificate(r: CertificateRow): Certificate {
  return {
    id: r.id,
    serial: r.serial,
    userId: r.user_id,
    courseId: r.course_id,
    recipientName: r.recipient_name ?? "",
    courseTitle: r.course_title ?? "",
    issuedAt: toMs(r.issued_at) ?? 0,
  };
}

/** What the mint RPC returns: the issued serial + when it was minted. */
export type IssuedCertificate = { serial: string; issuedAt: number };

/**
 * Mint (or return the existing) completion certificate for a user + course.
 *
 * Delegates to the `issue_certificate` SECURITY DEFINER RPC, which re-checks
 * server-side that `course_progress.completed_at` is set (the client cannot
 * assert completion) and is idempotent on (user, course): a second call returns
 * the same serial rather than minting a duplicate. The display fields
 * (recipient name, course title) are snapshotted at mint time inside the RPC,
 * so a later course/profile rename never mutates an issued certificate.
 *
 * Throws when the course isn't complete (RPC raises P0001) so the caller can
 * surface a clear "not finished yet" message instead of a silent no-op.
 */
export async function issueCertificate(
  userId: string,
  courseId: string,
): Promise<IssuedCertificate> {
  const { data, error } = await getDb().rpc("issue_certificate", {
    p_user_id: userId,
    p_course_id: courseId,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row) throw new Error("Certificate could not be issued");
  return { serial: row.serial, issuedAt: toMs(row.issued_at) ?? 0 };
}

/**
 * Public certificate lookup by its shareable serial — backs the `/cert/$serial`
 * verify page and the certificate image endpoint. Serials are random (6 bytes),
 * so they are not enumerable; the RLS policy intentionally allows reading the
 * snapshot fields (recipient name, course title) by serial for verification.
 */
export async function getCertificateBySerial(
  serial: string,
): Promise<Certificate | null> {
  const { data } = await getDb()
    .from("certificates")
    .select("*")
    .eq("serial", serial)
    .maybeSingle();
  return data ? rowToCertificate(data) : null;
}

/** The user's certificate for a specific course, if they've earned one. */
export async function getCertificate(
  userId: string,
  courseId: string,
): Promise<Certificate | null> {
  const { data } = await getDb()
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return data ? rowToCertificate(data) : null;
}

/** All certificates a user has earned (newest first), for the account page. */
export async function listCertificates(userId: string): Promise<Certificate[]> {
  const { data } = await getDb()
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });
  return (data ?? []).map(rowToCertificate);
}
