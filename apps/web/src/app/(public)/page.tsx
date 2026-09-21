// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, buildWebPageJsonLd, getRobotsMetadata } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getHomepageData } from "@/lib/public-data";
import { StoryCard } from "@/components/StoryCard";
import { JsonLd } from "@/components/JsonLd";

export function generateMetadata(): Metadata {
  const config = getSeoConfig();
  const meta = buildPageMetadata(config, {
    title: `${config.siteName} – Đọc truyện online miễn phí`,
    description: `${config.siteName} là nền tảng đọc truyện do cộng đồng sáng tác, cập nhật chương mới mỗi ngày.`,
    path: "/",
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogType: "website",
  });
  return meta as Metadata;
}

export default async function HomePage() {
  const config = getSeoConfig();
  const { latest, popularCategories, creators } = await getHomepageData();

  return (
    <main>
      <JsonLd data={buildWebPageJsonLd(config, { name: config.siteName, description: "Trang chủ ContentHub", path: "/" })} />

      <div className="container hero">
        <h1>{config.siteName}</h1>
        <p>Đọc truyện online do cộng đồng sáng tác — cập nhật chương mới mỗi ngày.</p>
      </div>

      <div className="container">
        <section>
          <div className="section-head">
            <h2>Truyện mới cập nhật</h2>
            <Link href="/truyen" className="text-sm">
              Xem tất cả →
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="empty-state">Chưa có truyện nào được xuất bản.</p>
          ) : (
            <div className="card-grid">
              {latest.map((story) => (
                <StoryCard
                  key={story.id}
                  story={{ slug: story.slug, title: story.title, coverImage: story.coverImage, shortDescription: story.shortDescription, creatorName: story.creator.displayName }}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <h2>Thể loại</h2>
            <Link href="/the-loai" className="text-sm">
              Xem tất cả →
            </Link>
          </div>
          <ul className="chip-list">
            {popularCategories.map((category) => (
              <li key={category.id}>
                <Link href={`/the-loai/${category.slug}`} className="chip">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="section-head">
            <h2>Tác giả nổi bật</h2>
            <Link href="/tac-gia" className="text-sm">
              Xem tất cả →
            </Link>
          </div>
          <ul className="avatar-list">
            {creators.map((creator) => (
              <li key={creator.id}>
                <Link href={`/tac-gia/${creator.slug}`} className="avatar-chip">
                  <span className="avatar-fallback" aria-hidden="true">
                    {creator.displayName.charAt(0).toUpperCase()}
                  </span>
                  {creator.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
