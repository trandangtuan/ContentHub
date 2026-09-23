// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { buildSitemapIndexXml } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { StorySitemapProvider, ChapterSitemapProvider, ArticleSitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

/**
 * Sitemap index (docs/SEO.md #18), pointing to chunked children instead of
 * one giant file. Only PUBLISHED+PUBLIC+non-deleted URLs are ever
 * reachable from here — see the individual sitemap providers.
 */
export async function GET() {
  const { siteUrl } = getSeoConfig();
  const now = new Date().toISOString();

  const [storyPages, chapterPages, articlePages] = await Promise.all([
    new StorySitemapProvider().pageCount(),
    new ChapterSitemapProvider().pageCount(),
    new ArticleSitemapProvider().pageCount(),
  ]);

  const sitemaps = [
    { loc: `${siteUrl}/sitemap-pages.xml`, lastmod: now },
    ...Array.from({ length: storyPages }, (_, i) => ({ loc: `${siteUrl}/sitemap-stories/${i + 1}`, lastmod: now })),
    ...Array.from({ length: chapterPages }, (_, i) => ({ loc: `${siteUrl}/sitemap-chapters/${i + 1}`, lastmod: now })),
    ...Array.from({ length: articlePages }, (_, i) => ({ loc: `${siteUrl}/sitemap-articles/${i + 1}`, lastmod: now })),
    { loc: `${siteUrl}/sitemap-authors.xml`, lastmod: now },
    { loc: `${siteUrl}/sitemap-categories.xml`, lastmod: now },
    { loc: `${siteUrl}/sitemap-tags.xml`, lastmod: now },
  ];

  return xmlResponse(buildSitemapIndexXml(sitemaps));
}
