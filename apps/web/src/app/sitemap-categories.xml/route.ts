import { buildSitemapXml } from "@contenthub/seo";
import { CategorySitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

export async function GET() {
  const { entries } = await new CategorySitemapProvider().getUrls();
  return xmlResponse(buildSitemapXml(entries));
}
