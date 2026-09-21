import { buildSitemapXml } from "@contenthub/seo";
import { TagSitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

export async function GET() {
  const { entries } = await new TagSitemapProvider().getUrls();
  return xmlResponse(buildSitemapXml(entries));
}
