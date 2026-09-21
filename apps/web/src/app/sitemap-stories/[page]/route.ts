import { buildSitemapXml } from "@contenthub/seo";
import { StorySitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const { entries } = await new StorySitemapProvider().getUrls(page);
  return xmlResponse(buildSitemapXml(entries));
}
