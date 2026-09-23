// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { buildSitemapXml, contentTypeByPrefix } from "@contenthub/seo";
import { ContentSitemapProvider } from "@/lib/sitemap-providers";
import { xmlResponse } from "@/lib/xml-response";

/** Generic per-type item sitemap (packages/seo's registry) — a new type needs no new sitemap route. */
export async function GET(_request: Request, { params }: { params: Promise<{ section: string; page: string }> }) {
  const { section, page } = await params;
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig) notFound();

  const { entries } = await new ContentSitemapProvider(typeConfig).getUrls(page);
  return xmlResponse(buildSitemapXml(entries));
}
