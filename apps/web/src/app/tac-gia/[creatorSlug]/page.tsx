// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { buildPageMetadata, buildPersonOrOrganizationJsonLd, buildBreadcrumbJsonLd, breadcrumbs, getRobotsMetadata, titleTemplates, paths } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getAuthorBySlug, getAuthorStories } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";

interface Params {
  creatorSlug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { creatorSlug } = await params;
  const config = getSeoConfig();
  const creator = await getAuthorBySlug(creatorSlug);
  if (!creator) return { robots: { index: false, follow: false } };

  return buildPageMetadata(config, {
    title: titleTemplates.author(creator.displayName, config.siteName),
    description: creator.bio ?? `Truyện của ${creator.displayName} trên ${config.siteName}.`,
    path: paths.author(creator.slug),
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogImage: creator.avatarUrl ?? undefined,
    ogType: "profile",
  }) as Metadata;
}

export default async function AuthorPage({ params }: { params: Promise<Params> }) {
  const { creatorSlug } = await params;
  const config = getSeoConfig();
  const creator = await getAuthorBySlug(creatorSlug);
  if (!creator) notFound();

  const stories = await getAuthorStories(creator.id);
  const trail = breadcrumbs.author(creator.displayName, creator.slug);

  return (
    <main className="container">
      <JsonLd
        data={buildPersonOrOrganizationJsonLd({
          name: creator.displayName,
          url: `${config.siteUrl}${paths.author(creator.slug)}`,
          image: creator.avatarUrl ?? undefined,
          isOrganization: creator.isOrganization,
        })}
      />
      <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
      <Breadcrumbs items={trail} />

      <header>
        {creator.avatarUrl ? <Image src={creator.avatarUrl} alt={`Ảnh đại diện ${creator.displayName}`} width={96} height={96} /> : null}
        <h1>{creator.displayName}</h1>
        {creator.bio ? <p>{creator.bio}</p> : null}
        <p>Tham gia: {creator.createdAt.toLocaleDateString(config.defaultLocale)}</p>
      </header>

      <section>
        <h2>Truyện đã xuất bản ({stories.length})</h2>
        <div className="card-grid">
          {stories.map((story) => (
            <StoryCard key={story.id} story={{ slug: story.slug, title: story.title, coverImage: story.coverImage, shortDescription: story.shortDescription }} />
          ))}
        </div>
      </section>
    </main>
  );
}
