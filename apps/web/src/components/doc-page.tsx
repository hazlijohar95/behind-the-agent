import { Prose } from "@btc/ui/components/mdx";
import { notFound } from "@tanstack/react-router";
import { loadDoc } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";

export function DocPage({ slug }: { slug: string }) {
  const source = loadDoc(slug);
  if (!source) throw notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Prose className="text-base">
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />
      </Prose>
    </article>
  );
}
