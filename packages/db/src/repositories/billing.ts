import { getDb } from "../client";
import type { Database } from "../database.types";

type BillingRow = Database["public"]["Tables"]["billing"]["Row"];
type BillingInsert = Database["public"]["Tables"]["billing"]["Insert"];

/** A user's subscription/billing state, mirrored from Polar. */
export type BillingRecord = {
  userId: string;
  polarCustomerId: string | null;
  status: string | null; // active | trialing | past_due | canceled | ...
  planId: string | null;
  currentPeriodEnd: number | null; // unix seconds
  updatedAt: number;
};

function rowToBilling(r: BillingRow): BillingRecord {
  return {
    userId: r.user_id,
    polarCustomerId: r.polar_customer_id,
    status: r.status,
    planId: r.plan_id,
    currentPeriodEnd: r.current_period_end,
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function getBilling(
  userId: string,
): Promise<BillingRecord | null> {
  const { data } = await getDb()
    .from("billing")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? rowToBilling(data) : null;
}

export async function setBilling(record: BillingRecord): Promise<void> {
  const row: BillingInsert = {
    user_id: record.userId,
    polar_customer_id: record.polarCustomerId,
    status: record.status,
    plan_id: record.planId,
    current_period_end: record.currentPeriodEnd,
    updated_at: new Date().toISOString(),
  };
  await getDb().from("billing").upsert(row, { onConflict: "user_id" });
}

export async function linkCustomer(
  customerId: string,
  userId: string,
): Promise<void> {
  const row: BillingInsert = {
    user_id: userId,
    polar_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };
  await getDb().from("billing").upsert(row, { onConflict: "user_id" });
}

export async function getUserIdByCustomer(
  customerId: string,
): Promise<string | null> {
  const { data } = await getDb()
    .from("billing")
    .select("user_id")
    .eq("polar_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}
