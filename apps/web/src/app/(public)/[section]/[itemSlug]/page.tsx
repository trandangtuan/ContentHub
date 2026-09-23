// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  buildPageMetadata,
  buildContentJsonLd,
  buildBreadcrumbJsonLd,
  breadcrumbs,
  getRobotsMetadata,
  titleTemplates,
  buildItemDescription,
  paths,
  contentTypeByPrefix,
} from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import {
  getItemBySlug,
  getSinglePart,
  getPublishedParts,
  PART_LIST_PAGE_SIZE,
  getItemViewCount,
  getRelatedItems,
  getRecentItems,
} from "@/lib/public-data";
import { ContentCard } from "@/components/ContentCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ChapterViewTracker } from "@/components/ChapterViewTracker";
import { sanitizeContentHtml } from "@/lib/sanitize";

interface Params {
  section: string;
  itemSlug: string;
}

function resolveType(section: string) {
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig) notFound();
  return typeConfig;
}

// Both "never existed" and "soft-deleted" render 404 here; the API layer
// (apps/api) is the one that distinguishes 404 vs 410 today — doing so from
// a Server Component would need middleware to set a non-404 status code,
// which is out of scope for this pass (see docs/SEO.md #32).
async function loadItemOr404(section: string, itemSlug: string) {
  const typeConfig = resolveType(section);
  const item = await getItemBySlug(typeConfig.type, itemSlug);
  if (!item || item.deletedAt || item.status !== "PUBLISHED" || item.visibility !== "PUBLIC") notFound();
  return { typeConfig, item };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { section, itemSlug } = await params;
  const typeConfig = contentTypeByPrefix(section);
  if (!typeConfig) return { robots: { index: false, follow: false } };

  const config = getSeoConfig();
  const item = await getItemBySlug(typeConfig.type, itemSlug);
  if (!item || item.deletedAt || item.status !== "PUBLISHED" || item.visibility !== "PUBLIC") {
    return { robots: { index: false, follow: false } };
  }

  return buildPageMetadata(config, {
    title: titleTemplates.item(item.title, config.siteName),
    description: buildItemDescription(item.description, item.shortDescription),
    path: paths.item(typeConfig.urlPrefix, item.slug),
    robots: getRobotsMetadata({ kind: "content", status: item.status, visibility: item.visibility }),
    ogImage: item.coverImage ?? undefined,
    ogType: typeConfig.jsonLd === "newsArticle" ? "article" : "book",
  }) as Metadata;
}

export default async function ContentDetailPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ page?: string }> }) {
  const { section, itemSlug } = await params;
  const { page: pageParam } = await searchParams;
  const config = getSeoConfig();
  const { typeConfig, item } = await loadItemOr404(section, itemSlug);
  const attrs = (item.attributes as Record<string, unknown> | null) ?? {};

  const jsonLd = buildContentJsonLd(config, typeConfig.jsonLd, {
    title: item.title,
    description: item.description ?? item.shortDescription ?? "",
    image: item.coverImage ?? undefined,
    authorName: item.creator.displayName,
    authorUrl: `${config.siteUrl}${paths.author(item.creator.slug)}`,
    inLanguage: item.language,
    datePublished: item.publishedAt?.toISOString(),
    dateModified: item.updatedAt.toISOString(),
  });
  const trail = breadcrumbs.item(typeConfig, item.title, item.slug);

  if (typeConfig.partsMode === "single") {
    const [part, relatedItems] = await Promise.all([getSinglePart(item.id), getRecentItems(typeConfig.type, item.id)]);

    return (
      <main className="container">
        <ChapterViewTracker contentId={item.id} />
        <JsonLd data={jsonLd} />
        <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
        <Breadcrumbs items={trail} />

        <article>
          <header className="story-hero">
            {item.coverImage ? <Image src={item.coverImage} alt={item.title} width={800} height={450} priority /> : null}
            <div className="story-hero-info">
              <h1>{item.title}</h1>
              <address>
                Tác giả:{" "}
                <Link href={paths.author(item.creator.slug)} rel="author">
                  {item.creator.displayName}
                </Link>
              </address>
              <p className="text-sm text-muted">
                Đăng: {item.publishedAt?.toLocaleDateString(config.defaultLocale)} — Cập nhật: {item.updatedAt.toLocaleDateString(config.defaultLocale)}
                {part ? ` — ${part.readingTimeMinutes} phút đọc` : ""}
              </p>
            </div>
          </header>

          <section className="chapter-content" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(part?.bodyHtml ?? "") }} />

          {relatedItems.length > 0 && (
            <section>
              <h2>{typeConfig.label} khác</h2>
              <div className="card-grid">
                {relatedItems.map((related) => (
                  <ContentCard key={related.id} config={typeConfig} item={{ slug: related.slug, title: related.title, coverImage: related.coverImage, shortDescription: related.shortDescription, publishedAt: related.publishedAt }} />
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
    );
  }

  // "multi" (a Story-shaped item with an ordered, independently-published chapter list)
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const pageSize = PART_LIST_PAGE_SIZE;
  const [{ items: parts, total: totalParts }, viewCount, relatedItems] = await Promise.all([
    getPublishedParts(item.id, { limit: pageSize, offset: (page - 1) * pageSize }),
    getItemViewCount(item.id),
    getRelatedItems(typeConfig.type, { id: item.id, creatorId: item.creatorId, categoryIds: item.categories.map((c) => c.categoryId) }),
  ]);
  const totalPartPages = Math.max(1, Math.ceil(totalParts / pageSize));

  return (
    <main className="container">
      <JsonLd data={jsonLd} />
      <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
      <Breadcrumbs items={trail} />

      <article>
        <header className="story-hero">
          {item.coverImage ? <Image src={item.coverImage} alt={`Ảnh bìa ${typeConfig.itemLabel} ${item.title}`} width={200} height={267} priority /> : null}
          <div className="story-hero-info">
            <h1>{item.title}</h1>
            {typeof attrs.subtitle === "string" && attrs.subtitle ? <p className="subtitle">{attrs.subtitle}</p> : null}
            <address>
              Tác giả:{" "}
              <Link href={paths.author(item.creator.slug)} rel="author">
                {item.creator.displayName}
              </Link>
            </address>
            <p className="text-sm text-muted">
              Xuất bản: {item.publishedAt?.toLocaleDateString(config.defaultLocale)} — Cập nhật: {item.updatedAt.toLocaleDateString(config.defaultLocale)}
            </p>
            <p className="text-sm text-muted">{viewCount.toLocaleString(config.defaultLocale)} lượt xem</p>
            {item.categories.length > 0 && (
              <ul className="chip-list" style={{ marginTop: 12 }}>
                {item.categories.map(({ category }) => (
                  <li key={category.id}>
                    <Link href={paths.category(category.slug)} className="chip">
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <section>
          <h2>Giới thiệu</h2>
          <p>{item.description}</p>
        </section>

        {item.tags.length > 0 && (
          <section>
            <h2>Tag</h2>
            <ul className="chip-list">
              {item.tags.map(({ tag }) => (
                <li key={tag.id}>
                  <Link href={paths.tag(tag.slug)} className="chip">
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>Danh sách chương ({totalParts})</h2>
          {parts.length === 0 ? (
            <p className="empty-state">Chưa có chương nào được xuất bản.</p>
          ) : (
            <ol className="chapter-list" start={(page - 1) * pageSize + 1}>
              {parts.map((part) => (
                <li key={part.id}>
                  <Link href={paths.part(typeConfig.urlPrefix, item.slug, part.slug)}>{part.title}</Link>
                </li>
              ))}
            </ol>
          )}
          {totalPartPages > 1 && (
            <nav className="pagination" aria-label="Chapter list pagination">
              {page > 1 ? <a href={`${paths.item(typeConfig.urlPrefix, item.slug)}?page=${page - 1}`}>← Trang trước</a> : <span />}
              <span>
                Trang {page}/{totalPartPages}
              </span>
              {page < totalPartPages ? <a href={`${paths.item(typeConfig.urlPrefix, item.slug)}?page=${page + 1}`}>Trang sau →</a> : <span />}
            </nav>
          )}
        </section>

        {relatedItems.length > 0 && (
          <section>
            <h2>{typeConfig.label} liên quan</h2>
            <div className="card-grid">
              {relatedItems.map((related) => (
                <ContentCard key={related.id} config={typeConfig} item={{ slug: related.slug, title: related.title, coverImage: related.coverImage, shortDescription: related.shortDescription }} />
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
