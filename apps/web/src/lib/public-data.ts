import { prisma } from "@contenthub/database";

const publicStoryWhere = { type: "STORY" as const, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };

// `_count` must filter to publicly-visible content — an unfiltered count would
// mark a tag/category "indexable" off the strength of draft-only stories,
// producing a thin/empty page that still gets indexed (spec: no thin taxonomy pages).
const publicContentCountFilter = { where: { content: publicStoryWhere } };

export async function getStoryBySlug(slug: string) {
  return prisma.content.findFirst({
    where: { slug, type: "STORY" },
    include: {
      creator: true,
      story: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });
}

export const CHAPTER_LIST_PAGE_SIZE = 100;

/**
 * Paginated so a story with thousands of chapters never renders them all
 * into one HTML page (bad for TTFB/LCP and for crawl budget). Each chapter
 * still gets its own indexable URL and its own sitemap entry regardless of
 * which page of this list it falls on.
 */
export async function getPublishedChapters(contentId: string, { limit = CHAPTER_LIST_PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const where = { contentId, status: "PUBLISHED" as const, deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.contentPart.findMany({ where, orderBy: { position: "asc" }, take: limit, skip: offset }),
    prisma.contentPart.count({ where }),
  ]);
  return { items, total };
}

export async function getChapter(contentId: string, chapterSlug: string) {
  return prisma.contentPart.findFirst({ where: { contentId, slug: chapterSlug } });
}

/**
 * Raw view count for public display (docs/REVENUE.md: RAW -> VALID ->
 * QUALIFIED -> MONETIZED). Deliberately sums the `rawViews` stage only —
 * qualified/monetized figures are revenue-facing and must never surface
 * here. ContentView has no story-level rows, so a story's total is the sum
 * across all of its chapters' daily aggregates.
 */
export async function getStoryViewCount(contentId: string): Promise<number> {
  const result = await prisma.contentView.aggregate({ where: { contentId }, _sum: { rawViews: true } });
  return result._sum.rawViews ?? 0;
}

export async function getChapterViewCount(contentId: string, contentPartId: string): Promise<number> {
  const result = await prisma.contentView.aggregate({ where: { contentId, contentPartId }, _sum: { rawViews: true } });
  return result._sum.rawViews ?? 0;
}

export async function getAdjacentChapters(contentId: string, position: number) {
  const [previousChapter, nextChapter] = await Promise.all([
    prisma.contentPart.findFirst({ where: { contentId, status: "PUBLISHED", position: { lt: position } }, orderBy: { position: "desc" } }),
    prisma.contentPart.findFirst({ where: { contentId, status: "PUBLISHED", position: { gt: position } }, orderBy: { position: "asc" } }),
  ]);
  return { previousChapter, nextChapter };
}

export async function getAuthorBySlug(slug: string) {
  return prisma.creatorProfile.findFirst({ where: { slug, deletedAt: null } });
}

export async function getAuthorStories(creatorId: string) {
  return prisma.content.findMany({
    where: { creatorId, ...publicStoryWhere },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findFirst({
    where: { slug, deletedAt: null },
    include: { _count: { select: { contents: publicContentCountFilter } } },
  });
}

export async function getCategoryStories(categoryId: string, { limit = 24, offset = 0 } = {}) {
  const where = { ...publicStoryWhere, categories: { some: { categoryId } } };
  const [items, total] = await Promise.all([
    prisma.content.findMany({ where, orderBy: { publishedAt: "desc" }, take: limit, skip: offset }),
    prisma.content.count({ where }),
  ]);
  return { items, total };
}

/**
 * "Truyện liên quan" (spec: internal linking via real HTML <a>, no keyword
 * stuffing). Prefers stories sharing a category; falls back to the same
 * author when the story has no category yet. Always excludes itself.
 */
export async function getRelatedStories(content: { id: string; creatorId: string; categoryIds: string[] }, limit = 6) {
  if (content.categoryIds.length > 0) {
    const byCategory = await prisma.content.findMany({
      where: { ...publicStoryWhere, id: { not: content.id }, categories: { some: { categoryId: { in: content.categoryIds } } } },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
    if (byCategory.length > 0) return byCategory;
  }

  return prisma.content.findMany({
    where: { ...publicStoryWhere, id: { not: content.id }, creatorId: content.creatorId },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getTagBySlug(slug: string) {
  return prisma.tag.findFirst({
    where: { slug, deletedAt: null },
    include: { _count: { select: { contents: publicContentCountFilter } } },
  });
}

export async function getTagStories(tagId: string) {
  return prisma.content.findMany({
    where: { ...publicStoryWhere, tags: { some: { tagId } } },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getHomepageData() {
  const [latest, latestArticles, popularCategories, creators] = await Promise.all([
    prisma.content.findMany({ where: publicStoryWhere, orderBy: { publishedAt: "desc" }, take: 12, include: { creator: true } }),
    prisma.content.findMany({ where: publicArticleWhere, orderBy: { publishedAt: "desc" }, take: 6, include: { creator: true } }),
    prisma.category.findMany({ where: { deletedAt: null }, take: 8 }),
    prisma.creatorProfile.findMany({ where: { deletedAt: null, contents: { some: publicStoryWhere } }, take: 6 }),
  ]);
  return { latest, latestArticles, popularCategories, creators };
}

export async function listPublishedStories({ limit = 24, offset = 0, categorySlug, tagSlug }: { limit?: number; offset?: number; categorySlug?: string; tagSlug?: string }) {
  const where = {
    ...publicStoryWhere,
    ...(categorySlug ? { categories: { some: { category: { slug: categorySlug } } } } : {}),
    ...(tagSlug ? { tags: { some: { tag: { slug: tagSlug } } } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.content.findMany({ where, orderBy: { publishedAt: "desc" }, take: limit, skip: offset, include: { creator: true } }),
    prisma.content.count({ where }),
  ]);
  return { items, total };
}

// ── Articles ("tin tức" — daily news) ───────────────────────────────────────

const publicArticleWhere = { type: "ARTICLE" as const, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };

export async function getArticleBySlug(slug: string) {
  return prisma.content.findFirst({
    where: { slug, type: "ARTICLE" },
    include: { creator: true, article: true },
  });
}

export async function listPublishedArticles({ limit = 24, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const [items, total] = await Promise.all([
    prisma.content.findMany({ where: publicArticleWhere, orderBy: { publishedAt: "desc" }, take: limit, skip: offset, include: { creator: true } }),
    prisma.content.count({ where: publicArticleWhere }),
  ]);
  return { items, total };
}

/** "Tin khác" (more news) — most recent other articles, excluding itself. */
export async function getRecentArticles(excludeId: string, limit = 6) {
  return prisma.content.findMany({
    where: { ...publicArticleWhere, id: { not: excludeId } },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}
