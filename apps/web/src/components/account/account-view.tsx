import { CertificatesCard } from "./certificates-card";
import { ContinueLearningCard } from "./continue-learning-card";
import { ProfileCard } from "./profile-card";
import { PurchasesCard } from "./purchases-card";
import { SubscriptionCard } from "./subscription-card";
import type { AccountData } from "./types";

export type { AccountData } from "./types";

export function AccountView({ data }: { data: AccountData }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Your account</h1>

      <ProfileCard user={data.user} />

      {data.continueLearning.length > 0 && (
        <ContinueLearningCard items={data.continueLearning} />
      )}

      {data.monetizationEnabled && (
        <SubscriptionCard billing={data.billing} hasPlans={data.hasPlans} />
      )}

      {data.certificates.length > 0 && (
        <CertificatesCard certificates={data.certificates} />
      )}

      {data.purchases.length > 0 && (
        <PurchasesCard purchases={data.purchases} />
      )}
    </div>
  );
}
