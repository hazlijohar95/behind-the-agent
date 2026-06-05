import { createFileRoute } from "@tanstack/react-router";
import { authedRoute, json } from "@/lib/api";
import { getBilling } from "@/lib/billing";
import { monetizationEnabled } from "@/lib/entitlements";
import { getPolar } from "@/lib/polar";

export const Route = createFileRoute("/api/polar/portal")({
  server: {
    handlers: {
      POST: authedRoute("user", async ({ user }) => {
        if (!monetizationEnabled())
          return json({ error: "Monetization is disabled" }, 501);

        const billing = await getBilling(user.id);
        if (!billing?.polarCustomerId) {
          return json({ error: "No billing account found" }, 400);
        }

        try {
          const session = await getPolar().customerSessions.create({
            externalCustomerId: user.id,
          });
          return json({ url: session.customerPortalUrl });
        } catch (err) {
          console.error("[polar portal]", err);
          return json({ error: "Could not open billing portal" }, 500);
        }
      }),
    },
  },
});
