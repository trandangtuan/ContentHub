// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { htmlToPlainText } from "@contenthub/shared";
import { buildPageMetadata, buildBreadcrumbJsonLd, breadcrumbs, getRobotsMetadata, titleTemplates, buildPartDescription, paths, contentTypeByPrefix } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getItemBySlug, getPart, getAdjacentParts, getPartViewCount } from "@/lib/public-data";
import { sanitizeContentHtml } from "@/lib/sanitize";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ChapterViewTracker } from "@/components/ChapterViewTracker";

interface Params {
  section: string;
  itemSlug: string;
  partSlug: string;
}

/** Only meaningful for a "multi" partsMode type — a "single" type's item page is itself the reader. */
async function loadPartOr404(section: string, itemSlug: string, partSlug: string) {
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig || typeConfig.partsMode !== "multi") notFound();

  const item = await getItemBySlug(typeConfig.type, itemSlug);
  if (!item || item.deletedAt || item.status !== "PUBLISHED" || item.visibility !== "PUBLIC") notFound();

  const part = await getPart(item.id, partSlug);
  if (!part || part.deletedAt || part.status !== "PUBLISHED") notFound();

  return { typeConfig, item, part };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { section, itemSlug, partSlug } = await params;
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig || typeConfig.partsMode !== "multi") return { robots: { index: false, follow: false } };

  const config = getSeoConfig();
  const item = await getItemBySlug(typeConfig.type, itemSlug);
  if (!item) return { robots: { index: false, follow: false } };

  const part = await getPart(item.id, partSlug);
  if (!part || part.status !== "PUBLISHED") return { robots: { index: false, follow: false } };

  const excerpt = htmlToPlainText(part.bodyHtml ?? "").slice(0, 200);

  return buildPageMetadata(config, {
    title: titleTemplates.part(part.title, item.title, config.siteName),
    description: buildPartDescription(part.title, item.title, excerpt),
    path: paths.part(typeConfig.urlPrefix, item.slug, part.slug),
    robots: getRobotsMetadata({ kind: "content", status: item.status, visibility: item.visibility }),
    ogType: "article",
  }) as Metadata;
}

// This page is intentionally minimal: no dashboard/editor code, no heavy
// analytics/recommendation widgets loaded before the content
// (docs/SEO.md #7, #33) — just the text, navigation, structured data, and
// ChapterViewTracker (renders nothing; fires one beacon on unload/tab-hide,
// see docs/REVENUE.md #36-37).
export default async function PartPage({ params }: { params: Promise<Params> }) {
  const { section, itemSlug, partSlug } = await params;
  const config = getSeoConfig();
  const { typeConfig, item, part } = await loadPartOr404(section, itemSlug, partSlug);
  const [{ previousPart, nextPart }, viewCount] = await Promise.all([
    getAdjacentParts(item.id, part.position),
    getPartViewCount(item.id, part.id),
  ]);

  const trail = breadcrumbs.part(typeConfig, item.title, item.slug, part.title, part.slug);
  const safeHtml = sanitizeContentHtml(part.bodyHtml ?? "");

  return (
    <main className="container">
      <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
      <ChapterViewTracker contentId={item.id} contentPartId={part.id} />
      <Breadcrumbs items={trail} />

      <article>
        <header style={{ maxWidth: "70ch", margin: "0 auto 32px" }}>
          <h1>{part.title}</h1>
          <p className="text-sm text-muted">
            <Link href={paths.item(typeConfig.urlPrefix, item.slug)}>{item.title}</Link>
            {" · "}
            <Link href={paths.author(item.creator.slug)} rel="author">
              {item.creator.displayName}
            </Link>
            {" · "}
            {part.readingTimeMinutes} phút đọc
            {" · "}
            {viewCount.toLocaleString(config.defaultLocale)} lượt xem
          </p>
        </header>

        <section className="chapter-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />

        <nav className="chapter-nav" aria-label="Chapter navigation" style={{ maxWidth: "70ch", margin: "40px auto 24px" }}>
          {previousPart ? <Link href={paths.part(typeConfig.urlPrefix, item.slug, previousPart.slug)}>&larr; {previousPart.title}</Link> : <span aria-disabled="true">&larr; Chương đầu</span>}
          <Link href={paths.item(typeConfig.urlPrefix, item.slug)}>Danh sách chương</Link>
          {nextPart ? <Link href={paths.part(typeConfig.urlPrefix, item.slug, nextPart.slug)}>{nextPart.title} &rarr;</Link> : <span aria-disabled="true">Chương cuối &rarr;</span>}
        </nav>
      </article>
    </main>
  );
}
