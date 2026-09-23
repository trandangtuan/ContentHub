// Reads live data from Postgres on every request; never statically cached at build time (docs/SEO.md — SSR-first, always-fresh).
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { buildPageMetadata, buildPersonOrOrganizationJsonLd, buildBreadcrumbJsonLd, breadcrumbs, getRobotsMetadata, titleTemplates, paths, contentTypeByKey } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getAuthorBySlug, getAuthorItems } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ContentCard } from "@/components/ContentCard";

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

  const items = await getAuthorItems(creator.id);
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

      <header className="story-hero">
        {creator.avatarUrl ? (
          <Image src={creator.avatarUrl} alt={`Ảnh đại diện ${creator.displayName}`} width={96} height={96} style={{ borderRadius: "50%" }} />
        ) : (
          <span className="avatar-fallback" aria-hidden="true" style={{ width: 96, height: 96, fontSize: "2rem" }}>
            {creator.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="story-hero-info">
          <h1>{creator.displayName}</h1>
          {creator.bio ? <p>{creator.bio}</p> : null}
          <p className="text-sm text-muted">Tham gia: {creator.createdAt.toLocaleDateString(config.defaultLocale)}</p>
        </div>
      </header>

      <section>
        <h2>Đã xuất bản ({items.length})</h2>
        {items.length === 0 ? (
          <p className="empty-state">Tác giả chưa xuất bản nội dung nào.</p>
        ) : (
          <div className="card-grid">
            {items.map((item) => {
              const typeConfig = contentTypeByKey(item.type);
              if (!typeConfig) return null;
              return <ContentCard key={item.id} config={typeConfig} item={{ slug: item.slug, title: item.title, coverImage: item.coverImage, shortDescription: item.shortDescription }} />;
            })}
          </div>
        )}
      </section>
    </main>
  );
}
