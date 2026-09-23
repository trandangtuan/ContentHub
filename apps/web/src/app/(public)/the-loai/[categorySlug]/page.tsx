// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata, buildBreadcrumbJsonLd, breadcrumbs, getRobotsMetadata, titleTemplates, paths, contentTypeByKey } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getCategoryBySlug, getCategoryItems } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ContentCard } from "@/components/ContentCard";

interface Params {
  categorySlug: string;
}

const PAGE_SIZE = 24;

// A category needs at least this many public stories to be worth an
// indexable SEO landing page — otherwise it's noindexed rather than
// deleted, matching the tag page's thin-taxonomy handling. This matters
// more now that creators can create categories themselves (not just admins),
// so a near-empty one is a realistic case, not just a hypothetical.
const MIN_STORIES_TO_INDEX = 2;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categorySlug } = await params;
  const config = getSeoConfig();
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return { robots: { index: false, follow: false } };

  const isIndexable = category._count.contents >= MIN_STORIES_TO_INDEX;

  return buildPageMetadata(config, {
    title: titleTemplates.category(category.name, config.siteName),
    description: category.description ?? `Danh sách truyện thể loại ${category.name} trên ${config.siteName}.`,
    path: paths.category(category.slug),
    robots: getRobotsMetadata(isIndexable ? { kind: "static-indexable" } : { kind: "thin-taxonomy" }),
    ogType: "website",
  }) as Metadata;
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ page?: string }> }) {
  const { categorySlug } = await params;
  const { page: pageParam } = await searchParams;
  const config = getSeoConfig();
  const category = await getCategoryBySlug(categorySlug);
  if (!category) notFound();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const { items, total } = await getCategoryItems(category.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const trail = breadcrumbs.category(category.name, category.slug);

  return (
    <main className="container">
      <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
      <Breadcrumbs items={trail} />

      <h1>{category.name}</h1>
      {category.description ? <p className="text-muted">{category.description}</p> : null}

      {items.length === 0 ? (
        <p className="empty-state">Chưa có nội dung nào ở thể loại này.</p>
      ) : (
        <div className="card-grid">
          {items.map((item) => {
            const typeConfig = contentTypeByKey(item.type);
            if (!typeConfig) return null;
            return <ContentCard key={item.id} config={typeConfig} item={{ slug: item.slug, title: item.title, coverImage: item.coverImage, shortDescription: item.shortDescription }} />;
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          {page > 1 ? <a href={`${paths.category(category.slug)}?page=${page - 1}`}>← Trang trước</a> : <span />}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages ? <a href={`${paths.category(category.slug)}?page=${page + 1}`}>Trang sau →</a> : <span />}
        </nav>
      )}
    </main>
  );
}
