/**
 * URL-safe slug generation with Unicode normalization.
 *
 * Rules (see docs/SEO.md #4): lowercase, unicode-normalized, hyphen-separated,
 * ASCII a-z0-9 only. Vietnamese đ/Đ are mapped explicitly because NFD does not
 * decompose them (they are not "d" + combining mark, they're their own codepoint).
 */
export function slugify(input: string): string {
  const withoutDStroke = input.replace(/đ/g, "d").replace(/Đ/g, "D");

  const normalized = withoutDStroke
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip combining diacritical marks

  const slug = normalized
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug;
}

/**
 * Appends a short disambiguator when a base slug collides with an existing one.
 * Callers retry with an incrementing `attempt` against the unique constraint
 * rather than trusting this to be collision-free on its own.
 */
export function disambiguateSlug(baseSlug: string, attempt: number): string {
  if (attempt <= 0) return baseSlug;
  return `${baseSlug}-${attempt + 1}`;
}

/** Fallback slug for input that normalizes away to nothing (e.g. CJK-only titles). */
export function slugifyWithFallback(input: string, fallback: string): string {
  const slug = slugify(input);
  return slug.length > 0 ? slug : slugify(fallback);
}
