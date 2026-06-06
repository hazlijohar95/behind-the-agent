import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

// These lock the Workers-safe sanitizer (no DOMPurify/jsdom): raw HTML is
// dropped and unsafe URL schemes are stripped, while normal formatting survives.
describe("renderMarkdown — XSS sanitization", () => {
  it("drops a block-level <script> entirely", () => {
    const out = renderMarkdown("hi\n\n<script>alert(1)</script>\n\nthere");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("hi");
    expect(out).toContain("there");
  });

  it("strips inline <script> tags (leftover text is inert, no executable markup)", () => {
    const out = renderMarkdown("hi <script>alert(1)</script> there");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("</script");
  });

  it("drops inline event-handler HTML (img onerror)", () => {
    const out = renderMarkdown('x <img src=z onerror="alert(1)"> y');
    expect(out).not.toContain("onerror");
    expect(out.toLowerCase()).not.toContain("<img src=z");
  });

  it("strips an iframe", () => {
    const out = renderMarkdown('<iframe src="https://evil.example"></iframe>');
    expect(out).not.toContain("<iframe");
  });

  it("neutralizes a javascript: link (keeps text, drops href)", () => {
    const out = renderMarkdown("[click me](javascript:alert(1))");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("href=");
    expect(out).toContain("click me");
  });

  it("neutralizes a data: image", () => {
    const out = renderMarkdown("![x](data:text/html;base64,PHNjcmlwdD4=)");
    expect(out).not.toContain("data:");
    expect(out).not.toContain("<img");
  });

  it("keeps a safe https link with rel hardening", () => {
    const out = renderMarkdown("[site](https://example.com)");
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain(">site<");
  });

  it("preserves ordinary markdown formatting", () => {
    const out = renderMarkdown("# Title\n\n**bold** and _em_\n\n- a\n- b");
    expect(out).toContain("<h1");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<li>a</li>");
  });

  it("allows relative links and anchors", () => {
    expect(renderMarkdown("[home](/)")).toContain('href="/"');
    expect(renderMarkdown("[top](#section)")).toContain('href="#section"');
  });
});
