// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata, getRobotsMetadata, contentTypeByPrefix, paths } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { listPublishedItems } from "@/lib/public-data";
import { ContentCard } from "@/components/ContentCard";

interface Params {
  section: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { section } = await params;
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig) return { robots: { index: false, follow: false } };

  const config = getSeoConfig();
  return buildPageMetadata(config, {
    title: `${typeConfig.label} – ${config.siteName}`,
    description: `Danh sách ${typeConfig.label.toLowerCase()} trên ${config.siteName}.`,
    path: paths.section(typeConfig.urlPrefix),
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogType: "website",
  }) as Metadata;
}

const PAGE_SIZE = 24;

/**
 * Generic list page for any ContentType (packages/seo's registry) — a new
 * type with the same shape (a title/cover/description card grid) needs no
 * new page, only a registry entry. `section` resolves the type by its
 * urlPrefix; an unknown section 404s, same as any other unmatched route.
 */
export default async function ContentListPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ page?: string }> }) {
  const { section } = await params;
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const { items, total } = await listPublishedItems(typeConfig.type, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="container">
      <h1>{typeConfig.label}</h1>
      {items.length === 0 ? (
        <p className="empty-state">Chưa có {typeConfig.itemLabel} nào.</p>
      ) : (
        <div className="card-grid">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              config={typeConfig}
              item={{ slug: item.slug, title: item.title, coverImage: item.coverImage, shortDescription: item.shortDescription, publishedAt: item.publishedAt, creatorName: item.creator.displayName }}
            />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          {page > 1 ? <a href={`${paths.section(typeConfig.urlPrefix)}?page=${page - 1}`}>← Trang trước</a> : <span />}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages ? <a href={`${paths.section(typeConfig.urlPrefix)}?page=${page + 1}`}>Trang sau →</a> : <span />}
        </nav>
      )}
    </main>
  );
}
