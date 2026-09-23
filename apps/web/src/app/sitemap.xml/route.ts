// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { buildSitemapIndexXml, CONTENT_TYPES } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { ContentSitemapProvider, PartSitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

/**
 * Sitemap index (docs/SEO.md #18), pointing to chunked children instead of
 * one giant file. Only PUBLISHED+PUBLIC+non-deleted URLs are ever
 * reachable from here — see the individual sitemap providers. Loops
 * packages/seo's content-type registry, so a new type is included with no
 * change here.
 */
export async function GET() {
  const { siteUrl } = getSeoConfig();
  const now = new Date().toISOString();

  const perType = await Promise.all(
    CONTENT_TYPES.map(async (typeConfig) => {
      const itemPages = await new ContentSitemapProvider(typeConfig).pageCount();
      const itemSitemaps = Array.from({ length: itemPages }, (_, i) => ({ loc: `${siteUrl}/sitemap/${typeConfig.urlPrefix}/${i + 1}`, lastmod: now }));

      if (typeConfig.partsMode !== "multi") return itemSitemaps;

      const partPages = await new PartSitemapProvider(typeConfig).pageCount();
      const partSitemaps = Array.from({ length: partPages }, (_, i) => ({ loc: `${siteUrl}/sitemap/${typeConfig.urlPrefix}/parts/${i + 1}`, lastmod: now }));
      return [...itemSitemaps, ...partSitemaps];
    }),
  );

  const sitemaps = [
    { loc: `${siteUrl}/sitemap-pages.xml`, lastmod: now },
    ...perType.flat(),
    { loc: `${siteUrl}/sitemap-authors.xml`, lastmod: now },
    { loc: `${siteUrl}/sitemap-categories.xml`, lastmod: now },
    { loc: `${siteUrl}/sitemap-tags.xml`, lastmod: now },
  ];

  return xmlResponse(buildSitemapIndexXml(sitemaps));
}
