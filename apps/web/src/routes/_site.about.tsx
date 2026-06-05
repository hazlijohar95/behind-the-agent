import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/doc-page";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [{ title: "About" }],
  }),
  component: About,
});

function About() {
  return <DocPage slug="about" />;
}
