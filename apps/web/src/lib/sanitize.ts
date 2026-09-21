import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "h2", "h3", "h4", "blockquote", "ul", "ol", "li", "strong", "em", "a", "img", "hr", "br"];

/**
 * Chapter/story HTML always passes through here before it's ever rendered
 * with dangerouslySetInnerHTML (spec #59) — editor output is trusted less
 * than the DB, and the DB is trusted less than a sanitizer.
 */
export function sanitizeContentHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "src", "alt", "title", "rel", "target"],
  });
}
