const docs = import.meta.glob("../content/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function loadDoc(slug: string): string | null {
  return docs[`../content/${slug}.md`] ?? null;
}
