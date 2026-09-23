export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Short TTL: sitemaps are a cheap indexed DB query (see sitemap-providers.ts),
      // so a newly published story/chapter should show up for a re-crawl within
      // minutes, not the hour a longer cache would otherwise hold a CDN/proxy to.
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
