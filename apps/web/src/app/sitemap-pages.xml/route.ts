import { buildSitemapXml, buildStaticPagesEntries } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { xmlResponse } from "@/lib/xml-response";

export async function GET() {
  const config = getSeoConfig();
  const entries = buildStaticPagesEntries(config, new Date().toISOString());
  return xmlResponse(buildSitemapXml(entries));
}
