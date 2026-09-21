import { buildSitemapXml } from "@contenthub/seo";
import { AuthorSitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

export async function GET() {
  const { entries } = await new AuthorSitemapProvider().getUrls();
  return xmlResponse(buildSitemapXml(entries));
}
