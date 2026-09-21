// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import { buildLlmsTxt } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";

export async function GET() {
  const text = buildLlmsTxt(getSeoConfig());
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
