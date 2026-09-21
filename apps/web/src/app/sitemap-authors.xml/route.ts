// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { buildSitemapXml } from "@contenthub/seo";
import { AuthorSitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

export async function GET() {
  const { entries } = await new AuthorSitemapProvider().getUrls();
  return xmlResponse(buildSitemapXml(entries));
}
