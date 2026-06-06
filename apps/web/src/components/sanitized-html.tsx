type SanitizedHtmlProps = {
  html: string;
  className?: string;
};

/**
 * The ONLY sanctioned `dangerouslySetInnerHTML` sink in the app. `html` MUST
 * already be sanitized upstream — in practice it always comes from
 * `renderMarkdown`, which runs DOMPurify (see M4). Centralizing the sink keeps
 * the security suppression in one reviewable place instead of scattered across
 * every render site.
 */
export function SanitizedHtml({ html, className }: SanitizedHtmlProps) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: html is sanitized upstream via renderMarkdown (DOMPurify)
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
