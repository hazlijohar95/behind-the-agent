import { planRepo, purchaseRepo, videoRepo } from "@btc/db";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  type AccountData,
  AccountView,
} from "@/components/account/account-view";
import { getBilling } from "@/lib/billing";
import { monetizationEnabled } from "@/lib/entitlements";
import { getCurrentUser } from "@/lib/session";

const requireAccountUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await getCurrentUser();
    return user ? { id: user.id } : null;
  },
);

const loadAccount = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: "/account" } });
  }

  let billing: AccountData["billing"] = null;
  let purchases: AccountData["purchases"] = [];
  let hasPlans = false;

  if (monetizationEnabled) {
    const [b, rawPurchases, plans] = await Promise.all([
      getBilling(user.id),
      purchaseRepo.listPurchases(user.id),
      planRepo.listPlans(),
    ]);
    hasPlans = plans.length > 0;

    let planName: string | null = null;
    if (b?.planId) planName = (await planRepo.getPlan(b.planId))?.name ?? null;
    billing = b
      ? { status: b.status, planName, currentPeriodEnd: b.currentPeriodEnd }
      : null;

    if (rawPurchases.length > 0) {
      const videos = await videoRepo.getVideos(
        rawPurchases.map((p) => p.videoId),
      );
      const byId = new Map(videos.map((v) => [v.id, v]));
      purchases = rawPurchases
        .map((p) => {
          const v = byId.get(p.videoId);
          if (!v) return null;
          return {
            videoId: p.videoId,
            title: v.title,
            slug: v.slug,
            amount: p.amount,
            currency: p.currency,
          };
        })
        .filter((p): p is AccountData["purchases"][number] => p !== null);
    }
  }

  const data: AccountData = {
    user: { name: user.name, email: user.email, image: user.image ?? null },
    monetizationEnabled,
    billing,
    hasPlans,
    purchases,
  };

  return data;
});

export const Route = createFileRoute("/_site/account")({
  beforeLoad: async () => {
    const user = await requireAccountUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: "/account" } });
    }
  },
  loader: () => loadAccount(),
  head: () => ({ meta: [{ title: "Account" }] }),
  component: AccountPage,
});

function AccountPage() {
  const data = Route.useLoaderData();
  return <AccountView data={data} />;
}
