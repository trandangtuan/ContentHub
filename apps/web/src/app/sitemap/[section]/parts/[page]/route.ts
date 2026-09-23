// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { buildSitemapXml, contentTypeByPrefix } from "@contenthub/seo";
import { PartSitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

/** Generic per-type parts (chapters) sitemap — only reachable for a "multi" partsMode type. */
export async function GET(_request: Request, { params }: { params: Promise<{ section: string; page: string }> }) {
  const { section, page } = await params;
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig || typeConfig.partsMode !== "multi") notFound();

  const { entries } = await new PartSitemapProvider(typeConfig).getUrls(page);
  return xmlResponse(buildSitemapXml(entries));
}
