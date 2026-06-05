export type AccountData = {
  user: { name: string; email: string; image: string | null };
  monetizationEnabled: boolean;
  billing: {
    status: string | null;
    planName: string | null;
    currentPeriodEnd: number | null;
  } | null;
  hasPlans: boolean;
  purchases: {
    videoId: string;
    title: string;
    slug: string;
    amount: number;
    currency: string;
  }[];
};
