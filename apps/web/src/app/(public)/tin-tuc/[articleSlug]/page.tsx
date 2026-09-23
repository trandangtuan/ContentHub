// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { buildPageMetadata, buildNewsArticleJsonLd, buildBreadcrumbJsonLd, breadcrumbs, getRobotsMetadata, titleTemplates, buildStoryDescription, paths } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getArticleBySlug, getRecentArticles } from "@/lib/public-data";
import { sanitizeContentHtml } from "@/lib/sanitize";
import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ChapterViewTracker } from "@/components/ChapterViewTracker";

interface Params {
  articleSlug: string;
}

// Both "never existed" and "soft-deleted" render 404 here — same tradeoff as
// the story page (docs/SEO.md #32: the API layer is what distinguishes 404 vs 410).
async function loadArticleOr404(articleSlug: string) {
  const article = await getArticleBySlug(articleSlug);
  if (!article || article.deletedAt || article.status !== "PUBLISHED" || article.visibility !== "PUBLIC") {
    notFound();
  }
  return article;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { articleSlug } = await params;
  const config = getSeoConfig();
  const article = await getArticleBySlug(articleSlug);

  if (!article || article.deletedAt || article.status !== "PUBLISHED" || article.visibility !== "PUBLIC") {
    return { robots: { index: false, follow: false } };
  }

  return buildPageMetadata(config, {
    title: titleTemplates.article(article.title, config.siteName),
    description: buildStoryDescription(article.description, article.shortDescription),
    path: paths.article(article.slug),
    robots: getRobotsMetadata({ kind: "content", status: article.status, visibility: article.visibility }),
    ogImage: article.coverImage ?? undefined,
    ogType: "article",
  }) as Metadata;
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { articleSlug } = await params;
  const config = getSeoConfig();
  const article = await loadArticleOr404(articleSlug);
  const recentArticles = await getRecentArticles(article.id);

  return (
    <main className="container">
      <ChapterViewTracker contentId={article.id} contentPartId={undefined} />

      <JsonLd
        data={buildNewsArticleJsonLd(config, {
          headline: article.title,
          description: article.description ?? article.shortDescription ?? "",
          image: article.coverImage ?? undefined,
          authorName: article.creator.displayName,
          authorUrl: `${config.siteUrl}${paths.author(article.creator.slug)}`,
          inLanguage: article.language,
          datePublished: article.publishedAt?.toISOString(),
          dateModified: article.updatedAt.toISOString(),
        })}
      />
      <JsonLd data={buildBreadcrumbJsonLd(config, breadcrumbs.article(article.title, article.slug))} />

      <Breadcrumbs items={breadcrumbs.article(article.title, article.slug)} />

      <article>
        <header className="story-hero">
          {article.coverImage ? <Image src={article.coverImage} alt={article.title} width={800} height={450} priority /> : null}
          <div className="story-hero-info">
            <h1>{article.title}</h1>
            <address>
              Tác giả:{" "}
              <Link href={paths.author(article.creator.slug)} rel="author">
                {article.creator.displayName}
              </Link>
            </address>
            <p className="text-sm text-muted">
              Đăng: {article.publishedAt?.toLocaleDateString(config.defaultLocale)} — Cập nhật: {article.updatedAt.toLocaleDateString(config.defaultLocale)} — {article.article?.readingTimeMinutes ?? 0} phút đọc
            </p>
          </div>
        </header>

        <section className="chapter-content" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(article.article?.bodyHtml ?? "") }} />

        {recentArticles.length > 0 && (
          <section>
            <h2>Tin khác</h2>
            <div className="card-grid">
              {recentArticles.map((related) => (
                <ArticleCard key={related.id} article={{ slug: related.slug, title: related.title, coverImage: related.coverImage, shortDescription: related.shortDescription, publishedAt: related.publishedAt }} />
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
