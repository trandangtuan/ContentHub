/**
 * Truncates text to at most `maxLength` grapheme clusters without splitting a
 * Unicode character in half (surrogate pairs, combining marks, emoji, etc.).
 * Used for SEO meta description truncation (docs/SEO.md #13).
 */
export function truncateText(input: string, maxLength: number, ellipsis = "…"): string {
  const graphemes = Array.from(input);
  if (graphemes.length <= maxLength) return input;

  const budget = Math.max(0, maxLength - ellipsis.length);
  const truncated = graphemes.slice(0, budget).join("");
  // Avoid cutting mid-word where possible.
  const lastSpace = truncated.lastIndexOf(" ");
  const clean = lastSpace > budget * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return `${clean.trimEnd()}${ellipsis}`;
}

/** Plain-text word count for CJK-agnostic Latin/Vietnamese content (whitespace-delimited). */
export function countWords(plainText: string): number {
  const trimmed = plainText.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/u).length;
}

const WORDS_PER_MINUTE = 200;

/** Reading time estimate in whole minutes, minimum 1 for any non-empty text. */
export function estimateReadingTimeMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/** Strips HTML tags down to plain text, for word counts / excerpts / meta description source. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
