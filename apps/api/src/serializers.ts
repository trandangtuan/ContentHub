import type { Content, ContentPart, CreatorProfile, Category, Tag, Story } from "@contenthub/database";

/**
 * Public API responses (spec #25): only what a reader/crawler may see.
 * Never include email, wallet, revenue, or internal moderation fields —
 * this is the one place that boundary is enforced for the JSON API.
 */
export function serializePublicStory(
  content: Content & { story: Story | null; creator: CreatorProfile; categories: { category: Category }[]; tags: { tag: Tag }[] },
  chapters: ContentPart[],
  siteUrl: string,
) {
  return {
    id: content.id,
    type: content.type,
    title: content.title,
    subtitle: content.story?.subtitle ?? null,
    slug: content.slug,
    description: content.description,
    shortDescription: content.shortDescription,
    coverImage: content.coverImage,
    language: content.language,
    ageRating: content.story?.ageRating ?? null,
    author: {
      slug: content.creator.slug,
      name: content.creator.displayName,
      url: `${siteUrl}/tac-gia/${content.creator.slug}`,
    },
    chapters: chapters.map((c) => ({ slug: c.slug, title: c.title, position: c.position, publishedAt: c.publishedAt })),
    genres: content.categories.map((c) => ({ slug: c.category.slug, name: c.category.name })),
    tags: content.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.name })),
    url: `${siteUrl}/truyen/${content.slug}`,
    publishedAt: content.publishedAt,
    updatedAt: content.updatedAt,
  };
}
