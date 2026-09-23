import type { SeoConfig } from "./config";

/**
 * Public URL path builders (docs/SEO.md #9). These are the ONLY source of
 * truth for public route shapes — never build a `/truyen/...` path inline
 * elsewhere, so a route change stays a one-file edit.
 */
export const paths = {
  home: () => "/",
  /** A content type's list page, e.g. section("truyen") -> "/truyen". */
  section: (urlPrefix: string) => `/${urlPrefix}`,
  /** A content item's detail page, e.g. item("truyen", slug) -> "/truyen/{slug}". */
  item: (urlPrefix: string, itemSlug: string) => `/${urlPrefix}/${itemSlug}`,
  /** A "multi" type's part (chapter) page — never used for a "single" type. */
  part: (urlPrefix: string, itemSlug: string, partSlug: string) => `/${urlPrefix}/${itemSlug}/${partSlug}`,
  authorList: () => "/tac-gia",
  author: (creatorSlug: string) => `/tac-gia/${creatorSlug}`,
  categoryList: () => "/the-loai",
  category: (categorySlug: string) => `/the-loai/${categorySlug}`,
  tag: (tagSlug: string) => `/tag/${tagSlug}`,
};

/**
 * Absolute canonical URL for a path. Canonical URLs never carry a query
 * string — utm_source/ref/sort/page must never fork a canonical page
 * (docs/SEO.md #10). If a query string sneaks in, it's stripped.
 */
export function buildCanonicalUrl(config: SeoConfig, path: string): string {
  const cleanPath = path.split("?")[0]!.split("#")[0]!;
  const normalized = cleanPath === "/" ? "/" : cleanPath.replace(/\/+$/, "");
  return `${config.siteUrl}${normalized}`;
}
