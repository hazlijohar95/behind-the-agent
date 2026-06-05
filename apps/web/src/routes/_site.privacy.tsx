import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/doc-page";

export const Route = createFileRoute("/_site/privacy")({
  head: () => ({
    meta: [{ title: "Privacy Policy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return <DocPage slug="privacy" />;
}
