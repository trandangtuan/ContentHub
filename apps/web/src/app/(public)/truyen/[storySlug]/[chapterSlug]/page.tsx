// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { htmlToPlainText } from "@contenthub/shared";
import {
  buildPageMetadata,
  buildBreadcrumbJsonLd,
  breadcrumbs,
  getRobotsMetadata,
  titleTemplates,
  buildChapterDescription,
  paths,
} from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getStoryBySlug, getChapter, getAdjacentChapters, getChapterViewCount } from "@/lib/public-data";
import { sanitizeContentHtml } from "@/lib/sanitize";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";

interface Params {
  storySlug: string;
  chapterSlug: string;
}

async function loadChapterOr404(storySlug: string, chapterSlug: string) {
  const story = await getStoryBySlug(storySlug);
  if (!story || story.deletedAt || story.status !== "PUBLISHED" || story.visibility !== "PUBLIC") notFound();

  const chapter = await getChapter(story.id, chapterSlug);
  if (!chapter || chapter.deletedAt || chapter.status !== "PUBLISHED") notFound();

  return { story, chapter };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { storySlug, chapterSlug } = await params;
  const config = getSeoConfig();
  const story = await getStoryBySlug(storySlug);
  if (!story) return { robots: { index: false, follow: false } };

  const chapter = await getChapter(story.id, chapterSlug);
  if (!chapter || chapter.status !== "PUBLISHED") return { robots: { index: false, follow: false } };

  const excerpt = htmlToPlainText(chapter.bodyHtml ?? "").slice(0, 200);

  return buildPageMetadata(config, {
    title: titleTemplates.chapter(chapter.title, story.title, config.siteName),
    description: buildChapterDescription(chapter.title, story.title, excerpt),
    path: paths.chapter(story.slug, chapter.slug),
    robots: getRobotsMetadata({ kind: "content", status: story.status, visibility: story.visibility }),
    ogType: "article",
  }) as Metadata;
}

// This page is intentionally minimal: no dashboard/editor code, no
// analytics/recommendation widgets loaded before the chapter content
// (docs/SEO.md #7, #33) — just the text, navigation, and structured data.
export default async function ChapterPage({ params }: { params: Promise<Params> }) {
  const { storySlug, chapterSlug } = await params;
  const config = getSeoConfig();
  const { story, chapter } = await loadChapterOr404(storySlug, chapterSlug);
  const [{ previousChapter, nextChapter }, viewCount] = await Promise.all([
    getAdjacentChapters(story.id, chapter.position),
    getChapterViewCount(story.id, chapter.id),
  ]);

  const trail = breadcrumbs.chapter(story.title, story.slug, chapter.title, chapter.slug);
  const safeHtml = sanitizeContentHtml(chapter.bodyHtml ?? "");

  return (
    <main className="container">
      <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
      <Breadcrumbs items={trail} />

      <article>
        <header style={{ maxWidth: "70ch", margin: "0 auto 32px" }}>
          <h1>{chapter.title}</h1>
          <p className="text-sm text-muted">
            <Link href={paths.story(story.slug)}>{story.title}</Link>
            {" · "}
            <Link href={paths.author(story.creator.slug)} rel="author">
              {story.creator.displayName}
            </Link>
            {" · "}
            {chapter.readingTimeMinutes} phút đọc
            {" · "}
            {viewCount.toLocaleString(config.defaultLocale)} lượt xem
          </p>
        </header>

        <section className="chapter-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />

        <nav className="chapter-nav" aria-label="Chapter navigation" style={{ maxWidth: "70ch", margin: "40px auto 24px" }}>
          {previousChapter ? <Link href={paths.chapter(story.slug, previousChapter.slug)}>&larr; {previousChapter.title}</Link> : <span aria-disabled="true">&larr; Chương đầu</span>}
          <Link href={paths.story(story.slug)}>Danh sách chương</Link>
          {nextChapter ? <Link href={paths.chapter(story.slug, nextChapter.slug)}>{nextChapter.title} &rarr;</Link> : <span aria-disabled="true">Chương cuối &rarr;</span>}
        </nav>
      </article>
    </main>
  );
}
