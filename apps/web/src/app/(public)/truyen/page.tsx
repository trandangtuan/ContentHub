// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { buildPageMetadata, getRobotsMetadata } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { listPublishedStories } from "@/lib/public-data";
import { StoryCard } from "@/components/StoryCard";

export function generateMetadata(): Metadata {
  const config = getSeoConfig();
  return buildPageMetadata(config, {
    title: `Danh sách truyện – ${config.siteName}`,
    description: `Danh sách truyện đang được cập nhật trên ${config.siteName}.`,
    path: "/truyen",
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogType: "website",
  }) as Metadata;
}

const PAGE_SIZE = 24;

export default async function StoryListPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const { items, total } = await listPublishedStories({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="container">
      <h1>Danh sách truyện</h1>
      {items.length === 0 ? (
        <p className="empty-state">Chưa có truyện nào.</p>
      ) : (
        <div className="card-grid">
          {items.map((story) => (
            <StoryCard key={story.id} story={{ slug: story.slug, title: story.title, coverImage: story.coverImage, shortDescription: story.shortDescription }} />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          {page > 1 ? <a href={`/truyen?page=${page - 1}`}>← Trang trước</a> : <span />}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages ? <a href={`/truyen?page=${page + 1}`}>Trang sau →</a> : <span />}
        </nav>
      )}
    </main>
  );
}
