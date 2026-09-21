// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata, buildBreadcrumbJsonLd, breadcrumbs, getRobotsMetadata, titleTemplates, paths } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getTagBySlug, getTagStories } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";

interface Params {
  tagSlug: string;
}

// A tag needs at least this many public stories to be worth an indexable
// SEO landing page (docs/SEO.md #45) — otherwise it's noindexed rather than
// deleted, so the page still works for the handful of readers who find it.
const MIN_STORIES_TO_INDEX = 2;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tagSlug } = await params;
  const config = getSeoConfig();
  const tag = await getTagBySlug(tagSlug);
  if (!tag) return { robots: { index: false, follow: false } };

  const isIndexable = tag._count.contents >= MIN_STORIES_TO_INDEX;

  return buildPageMetadata(config, {
    title: titleTemplates.tag(tag.name, config.siteName),
    description: `Truyện gắn tag ${tag.name} trên ${config.siteName}.`,
    path: paths.tag(tag.slug),
    robots: getRobotsMetadata(isIndexable ? { kind: "static-indexable" } : { kind: "thin-taxonomy" }),
    ogType: "website",
  }) as Metadata;
}

export default async function TagPage({ params }: { params: Promise<Params> }) {
  const { tagSlug } = await params;
  const config = getSeoConfig();
  const tag = await getTagBySlug(tagSlug);
  if (!tag) notFound();

  const stories = await getTagStories(tag.id);
  const trail = breadcrumbs.tag(tag.name, tag.slug);

  return (
    <main className="container">
      <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
      <Breadcrumbs items={trail} />

      <h1>Tag: {tag.name}</h1>

      {stories.length === 0 ? (
        <p className="empty-state">Chưa có truyện nào gắn tag này.</p>
      ) : (
        <div className="card-grid">
          {stories.map((story) => (
            <StoryCard key={story.id} story={{ slug: story.slug, title: story.title, coverImage: story.coverImage, shortDescription: story.shortDescription }} />
          ))}
        </div>
      )}
    </main>
  );
}
