import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata, buildBreadcrumbJsonLd, breadcrumbs, getRobotsMetadata, titleTemplates, paths } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";
import { getCategoryBySlug, getCategoryStories } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";

interface Params {
  categorySlug: string;
}

const PAGE_SIZE = 24;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categorySlug } = await params;
  const config = getSeoConfig();
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return { robots: { index: false, follow: false } };

  return buildPageMetadata(config, {
    title: titleTemplates.category(category.name, config.siteName),
    description: category.description ?? `Danh sách truyện thể loại ${category.name} trên ${config.siteName}.`,
    path: paths.category(category.slug),
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogType: "website",
  }) as Metadata;
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ page?: string }> }) {
  const { categorySlug } = await params;
  const { page: pageParam } = await searchParams;
  const config = getSeoConfig();
  const category = await getCategoryBySlug(categorySlug);
  if (!category) notFound();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const { items, total } = await getCategoryStories(category.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const trail = breadcrumbs.category(category.name, category.slug);

  return (
    <main className="container">
      <JsonLd data={buildBreadcrumbJsonLd(config, trail)} />
      <Breadcrumbs items={trail} />

      <h1>{category.name}</h1>
      {category.description ? <p>{category.description}</p> : null}

      <div className="card-grid">
        {items.map((story) => (
          <StoryCard key={story.id} story={{ slug: story.slug, title: story.title, coverImage: story.coverImage, shortDescription: story.shortDescription }} />
        ))}
      </div>

      <nav aria-label="Pagination">
        {page > 1 && <a href={`${paths.category(category.slug)}?page=${page - 1}`}>Trang trước</a>}
        <span> Trang {page}/{totalPages} </span>
        {page < totalPages && <a href={`${paths.category(category.slug)}?page=${page + 1}`}>Trang sau</a>}
      </nav>
    </main>
  );
}
