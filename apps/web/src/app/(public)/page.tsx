// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, buildWebPageJsonLd, getRobotsMetadata, paths, CONTENT_TYPES } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getHomepageData, getLatestItems } from "@/lib/public-data";
import { ContentCard } from "@/components/ContentCard";
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

/**
 * One "mới cập nhật" section per ContentType (packages/seo's registry) — a
 * new type shows up on the homepage automatically, no new section to write.
 */
export default async function HomePage() {
  const config = getSeoConfig();
  const [{ popularCategories, creators }, latestByType] = await Promise.all([
    getHomepageData(),
    Promise.all(CONTENT_TYPES.map((c) => getLatestItems(c.type, c.partsMode === "multi" ? 12 : 6))),
  ]);

  return (
    <main>
      <JsonLd data={buildWebPageJsonLd(config, { name: config.siteName, description: "Trang chủ ContentHub", path: "/" })} />

      <div className="container hero">
        <h1>{config.siteName}</h1>
        <p>Đọc truyện online do cộng đồng sáng tác — cập nhật chương mới mỗi ngày.</p>
      </div>

      <div className="container">
        {CONTENT_TYPES.map((typeConfig, i) => {
          const items = latestByType[i]!;
          return (
            <section key={typeConfig.type}>
              <div className="section-head">
                <h2>{typeConfig.label} mới cập nhật</h2>
                <Link href={paths.section(typeConfig.urlPrefix)} className="text-sm">
                  Xem tất cả →
                </Link>
              </div>
              {items.length === 0 ? (
                <p className="empty-state">Chưa có {typeConfig.itemLabel} nào được xuất bản.</p>
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
            </section>
          );
        })}

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
