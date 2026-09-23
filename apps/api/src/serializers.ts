import type { Content, ContentPart, CreatorProfile, Category, Tag } from "@contenthub/database";
import { paths, type ContentTypeConfig } from "@contenthub/seo";

/**
 * Public API responses (spec #25): only what a reader/crawler may see.
 * Never include email, wallet, revenue, or internal moderation fields —
 * this is the one place that boundary is enforced for the JSON API.
 *
 * Generic across every ContentType (packages/seo's registry): `attributes`
 * carries type-specific scalar metadata (e.g. STORY's subtitle/ageRating);
 * `parts` (only passed for a "multi" type) becomes `chapters`; a "single"
 * type's sole part is flattened into `bodyHtml`/`wordCount`/`readingTimeMinutes`.
 */
export function serializePublicContent(
  content: Content & { creator: CreatorProfile; categories: { category: Category }[]; tags: { tag: Tag }[] },
  config: ContentTypeConfig,
  siteUrl: string,
  parts: ContentPart[] = [],
) {
  const base = {
    id: content.id,
    type: content.type,
    title: content.title,
    slug: content.slug,
    description: content.description,
    shortDescription: content.shortDescription,
    coverImage: content.coverImage,
    language: content.language,
    attributes: (content.attributes as Record<string, unknown> | null) ?? {},
    author: {
      slug: content.creator.slug,
      name: content.creator.displayName,
      url: `${siteUrl}${paths.author(content.creator.slug)}`,
    },
    genres: content.categories.map((c) => ({ slug: c.category.slug, name: c.category.name })),
    tags: content.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.name })),
    url: `${siteUrl}${paths.item(config.urlPrefix, content.slug)}`,
    publishedAt: content.publishedAt,
    updatedAt: content.updatedAt,
  };

  if (config.partsMode === "multi") {
    return { ...base, chapters: parts.map((p) => ({ slug: p.slug, title: p.title, position: p.position, publishedAt: p.publishedAt })) };
  }

  const singlePart = parts[0];
  return {
    ...base,
    bodyHtml: singlePart?.bodyHtml ?? null,
    wordCount: singlePart?.wordCount ?? 0,
    readingTimeMinutes: singlePart?.readingTimeMinutes ?? 0,
  };
}
