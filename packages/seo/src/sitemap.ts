import type { SeoConfig } from "./config";

export interface SitemapEntry {
  loc: string; // absolute URL
  lastmod: string; // ISO date, must reflect real content update time (docs/SEO.md #19)
}

export interface SitemapPage {
  entries: SitemapEntry[];
  nextCursor: string | null;
}

/**
 * One provider per URL family (Story/Chapter/Author/Category/Tag), each
 * cursor-paginated so a sitemap with millions of URLs never loads them all
 * into memory at once (docs/SEO.md #18, #50). Only PUBLIC+PUBLISHED+
 * indexable rows may be yielded — providers must filter at the query level,
 * not rely on callers to filter afterwards.
 */
export interface SitemapProvider {
  /** Used to name this provider's sitemap file(s), e.g. "stories" -> sitemap-stories-1.xml */
  key: string;
  getUrls(cursor?: string): Promise<SitemapPage>;
}

export const MAX_URLS_PER_SITEMAP = 10_000; // well under Google's 50,000/50MB limit, keeps files small and fast to regenerate

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urlEntries = entries
    .map((e) => `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod: string;
}

export function buildSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  const entries = sitemaps
    .map((s) => `  <sitemap>\n    <loc>${escapeXml(s.loc)}</loc>\n    <lastmod>${s.lastmod}</lastmod>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
}

/** Static, always-indexable top-level pages (homepage, story list, author list, category list). */
export function buildStaticPagesEntries(config: SeoConfig, lastmod: string): SitemapEntry[] {
  return ["/", "/truyen", "/tac-gia", "/the-loai"].map((path) => ({
    loc: `${config.siteUrl}${path}`,
    lastmod,
  }));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
