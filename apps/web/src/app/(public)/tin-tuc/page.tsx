// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { buildPageMetadata, getRobotsMetadata } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { listPublishedArticles } from "@/lib/public-data";
import { ArticleCard } from "@/components/ArticleCard";

export function generateMetadata(): Metadata {
  const config = getSeoConfig();
  return buildPageMetadata(config, {
    title: `Tin tức – ${config.siteName}`,
    description: `Tin tức hàng ngày từ các tác giả trên ${config.siteName}.`,
    path: "/tin-tuc",
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogType: "website",
  }) as Metadata;
}

const PAGE_SIZE = 24;

export default async function ArticleListPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const { items, total } = await listPublishedArticles({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="container">
      <h1>Tin tức</h1>
      {items.length === 0 ? (
        <p className="empty-state">Chưa có tin tức nào.</p>
      ) : (
        <div className="card-grid">
          {items.map((article) => (
            <ArticleCard
              key={article.id}
              article={{
                slug: article.slug,
                title: article.title,
                coverImage: article.coverImage,
                shortDescription: article.shortDescription,
                publishedAt: article.publishedAt,
                creatorName: article.creator.displayName,
              }}
            />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          {page > 1 ? <a href={`/tin-tuc?page=${page - 1}`}>← Trang trước</a> : <span />}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages ? <a href={`/tin-tuc?page=${page + 1}`}>Trang sau →</a> : <span />}
        </nav>
      )}
    </main>
  );
}
