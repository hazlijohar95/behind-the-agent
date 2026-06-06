import { type BillingRecord, billingRepo } from "@btc/db";

export type { BillingRecord };

// Lazy wrappers: reference billingRepo.* at call time, not module-eval time.
// Eagerly capturing namespace members here (`export const x = billingRepo.x`)
// is sensitive to bundler init ordering and broke SSR for every route that
// imports this module.
export const getBilling: typeof billingRepo.getBilling = (...args) =>
  billingRepo.getBilling(...args);
export const setBilling: typeof billingRepo.setBilling = (...args) =>
  billingRepo.setBilling(...args);
export const linkCustomer: typeof billingRepo.linkCustomer = (...args) =>
  billingRepo.linkCustomer(...args);
export const getUserIdByCustomer: typeof billingRepo.getUserIdByCustomer = (
  ...args
) => billingRepo.getUserIdByCustomer(...args);

export function isActive(billing: BillingRecord | null): boolean {
  if (!billing?.status) return false;
  if (billing.status !== "active" && billing.status !== "trialing")
    return false;
  if (billing.currentPeriodEnd && billing.currentPeriodEnd * 1000 < Date.now())
    return false;
  return true;
}
