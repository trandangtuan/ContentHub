// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { buildSitemapXml } from "@contenthub/seo";
import { StorySitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const { entries } = await new StorySitemapProvider().getUrls(page);
  return xmlResponse(buildSitemapXml(entries));
}
