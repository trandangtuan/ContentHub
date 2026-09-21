// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { buildSitemapXml, buildStaticPagesEntries } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { xmlResponse } from "@/lib/xml-response";

export async function GET() {
  const config = getSeoConfig();
  const entries = buildStaticPagesEntries(config, new Date().toISOString());
  return xmlResponse(buildSitemapXml(entries));
}
