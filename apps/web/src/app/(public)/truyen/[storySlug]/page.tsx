// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  buildPageMetadata,
  buildBookJsonLd,
  buildBreadcrumbJsonLd,
  breadcrumbs,
  getRobotsMetadata,
  titleTemplates,
  buildStoryDescription,
  paths,
} from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getStoryBySlug, getPublishedChapters } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";

interface Params {
  storySlug: string;
}

// Both "never existed" and "soft-deleted" render 404 here; the API layer
// (apps/api) is the one that distinguishes 404 vs 410 today — doing so from
// a Server Component would need middleware to set a non-404 status code,
// which is out of scope for this pass (see docs/SEO.md #32).
async function loadStoryOr404(storySlug: string) {
  const story = await getStoryBySlug(storySlug);
  if (!story || story.deletedAt || story.status !== "PUBLISHED" || story.visibility !== "PUBLIC") {
    notFound();
  }
  return story;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { storySlug } = await params;
  const config = getSeoConfig();
  const story = await getStoryBySlug(storySlug);

  if (!story || story.deletedAt || story.status !== "PUBLISHED" || story.visibility !== "PUBLIC") {
    return { robots: { index: false, follow: false } };
  }

  return buildPageMetadata(config, {
    title: titleTemplates.story(story.title, config.siteName),
    description: buildStoryDescription(story.description, story.shortDescription),
    path: paths.story(story.slug),
    robots: getRobotsMetadata({ kind: "content", status: story.status, visibility: story.visibility }),
    ogImage: story.coverImage ?? undefined,
    ogType: "book",
  }) as Metadata;
}

export default async function StoryPage({ params }: { params: Promise<Params> }) {
  const { storySlug } = await params;
  const config = getSeoConfig();
  const story = await loadStoryOr404(storySlug);
  const chapters = await getPublishedChapters(story.id);

  return (
    <main className="container">
      <JsonLd
        data={buildBookJsonLd(config, {
          name: story.title,
          description: story.description ?? story.shortDescription ?? "",
          image: story.coverImage ?? undefined,
          authorName: story.creator.displayName,
          authorUrl: `${config.siteUrl}${paths.author(story.creator.slug)}`,
          inLanguage: story.language,
          datePublished: story.publishedAt?.toISOString(),
          dateModified: story.updatedAt.toISOString(),
        })}
      />
      <JsonLd data={buildBreadcrumbJsonLd(config, breadcrumbs.story(story.title, story.slug))} />

      <Breadcrumbs items={breadcrumbs.story(story.title, story.slug)} />

      <article>
        <header className="story-hero">
          {story.coverImage ? (
            <Image src={story.coverImage} alt={`Ảnh bìa truyện ${story.title}`} width={200} height={267} priority />
          ) : null}
          <div className="story-hero-info">
            <h1>{story.title}</h1>
            {story.story?.subtitle ? <p className="subtitle">{story.story.subtitle}</p> : null}
            <address>
              Tác giả:{" "}
              <Link href={paths.author(story.creator.slug)} rel="author">
                {story.creator.displayName}
              </Link>
            </address>
            <p className="text-sm text-muted">
              Xuất bản: {story.publishedAt?.toLocaleDateString(config.defaultLocale)} — Cập nhật: {story.updatedAt.toLocaleDateString(config.defaultLocale)}
            </p>
            {story.categories.length > 0 && (
              <ul className="chip-list" style={{ marginTop: 12 }}>
                {story.categories.map(({ category }) => (
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
          <p>{story.description}</p>
        </section>

        {story.tags.length > 0 && (
          <section>
            <h2>Tag</h2>
            <ul className="chip-list">
              {story.tags.map(({ tag }) => (
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
          <h2>Danh sách chương ({chapters.length})</h2>
          {chapters.length === 0 ? (
            <p className="empty-state">Chưa có chương nào được xuất bản.</p>
          ) : (
            <ol className="chapter-list">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <Link href={paths.chapter(story.slug, chapter.slug)}>{chapter.title}</Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </article>
    </main>
  );
}
