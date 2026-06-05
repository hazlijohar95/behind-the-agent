import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/doc-page";

export const Route = createFileRoute("/_site/terms")({
  head: () => ({
    meta: [{ title: "Terms of Service" }],
  }),
  component: Terms,
});

function Terms() {
  return <DocPage slug="terms" />;
}
