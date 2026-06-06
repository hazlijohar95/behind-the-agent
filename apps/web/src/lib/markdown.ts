import { Marked, type Tokens } from "marked";

/**
 * Render untrusted markdown to HTML for injection via `dangerouslySetInnerHTML`.
 *
 * It MUST be sanitized: `marked` passes raw HTML (incl. `<script>`,
 * `<img onerror>`, `<iframe>`) straight through, and link/image URLs can carry
 * `javascript:` / `data:` schemes — a stored-XSS sink for any markdown source
 * (video/course/lesson descriptions, doc pages).
 *
 * We do NOT use a DOM-based sanitizer (DOMPurify/jsdom): jsdom cannot run on the
 * Cloudflare Workers runtime and throws at import, which previously 500'd every
 * page that rendered markdown. Instead we sanitize purely within `marked`:
 *   - raw HTML tokens are dropped (no passthrough sink), and
 *   - link/image hrefs are restricted to safe schemes.
 * This keeps formatting (headings, bold, lists, links, images) while removing
 * the injection vectors, with no DOM dependency.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Allow http(s)/mailto/tel, anchors, and relative paths; reject everything else
 * (`javascript:`, `data:`, `vbscript:`, `file:`, …). Returns null if unsafe.
 */
function safeUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? "").trim();
  if (url === "") return null;
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url; // explicit safe schemes
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null; // any other scheme → unsafe
  return url; // scheme-less: relative path / anchor / query — safe
}

const md = new Marked();
md.use({
  renderer: {
    // Drop raw HTML entirely — the markdown sources only need formatting, never
    // embedded HTML, so this removes the <script>/<img onerror>/<iframe> sink.
    html() {
      return "";
    },
    link(token: Tokens.Link) {
      const inner = this.parser.parseInline(token.tokens);
      const href = safeUrl(token.href);
      if (href === null) return inner; // unsafe URL → render link text only
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      return `<a href="${escapeHtml(href)}"${title} rel="nofollow noopener noreferrer">${inner}</a>`;
    },
    image(token: Tokens.Image) {
      const alt = escapeHtml(token.text ?? "");
      const src = safeUrl(token.href);
      if (src === null) return alt; // unsafe src → render alt text only
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      return `<img src="${escapeHtml(src)}" alt="${alt}"${title} loading="lazy">`;
    },
  },
});

export function renderMarkdown(src: string): string {
  return md.parse(src, { async: false });
}
