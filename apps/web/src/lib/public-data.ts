import { prisma, type ContentType } from "@contenthub/database";
import { SINGLE_PART_SLUG, type ContentTypeConfig } from "@contenthub/seo";

/**
 * Generic across every ContentType (packages/seo's registry) — a page for a
 * new type reuses these unchanged, parameterized by `type`/`config` instead
 * of a new set of story-shaped or article-shaped functions.
 */
function publicWhere(type: ContentType) {
  return { type, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };
}

// `_count` must filter to publicly-visible content — an unfiltered count would
// mark a tag/category "indexable" off the strength of draft-only content,
// producing a thin/empty page that still gets indexed (spec: no thin taxonomy pages).
// Categories/tags aren't type-specific, so this stays type-agnostic across every ContentType.
const publicContentCountFilter = { where: { content: { status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null } } };

export async function getItemBySlug(type: ContentType, slug: string) {
  return prisma.content.findFirst({
    where: { slug, type },
    include: { creator: true, categories: { include: { category: true } }, tags: { include: { tag: true } } },
  });
}

/** For a "single" partsMode type — the one ContentPart holding its whole body. */
export async function getSinglePart(contentId: string) {
  return prisma.contentPart.findFirst({ where: { contentId, slug: SINGLE_PART_SLUG, deletedAt: null } });
}

export const PART_LIST_PAGE_SIZE = 100;

/**
 * Paginated so an item with thousands of parts never renders them all into
 * one HTML page (bad for TTFB/LCP and for crawl budget). Each part still
 * gets its own indexable URL and its own sitemap entry regardless of which
 * page of this list it falls on. Only meaningful for a "multi" type.
 */
export async function getPublishedParts(contentId: string, { limit = PART_LIST_PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const where = { contentId, status: "PUBLISHED" as const, deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.contentPart.findMany({ where, orderBy: { position: "asc" }, take: limit, skip: offset }),
    prisma.contentPart.count({ where }),
  ]);
  return { items, total };
}

export async function getPart(contentId: string, partSlug: string) {
  return prisma.contentPart.findFirst({ where: { contentId, slug: partSlug } });
}

/**
 * Raw view count for public display (docs/REVENUE.md: RAW -> VALID ->
 * QUALIFIED -> MONETIZED). Deliberately sums the `rawViews` stage only —
 * qualified/monetized figures are revenue-facing and must never surface
 * here. A "multi" type's total is the sum across all of its parts' daily
 * aggregates; a "single" type's total already lives at the item level.
 */
export async function getItemViewCount(contentId: string): Promise<number> {
  const result = await prisma.contentView.aggregate({ where: { contentId }, _sum: { rawViews: true } });
  return result._sum.rawViews ?? 0;
}

export async function getPartViewCount(contentId: string, contentPartId: string): Promise<number> {
  const result = await prisma.contentView.aggregate({ where: { contentId, contentPartId }, _sum: { rawViews: true } });
  return result._sum.rawViews ?? 0;
}

export async function getAdjacentParts(contentId: string, position: number) {
  const [previousPart, nextPart] = await Promise.all([
    prisma.contentPart.findFirst({ where: { contentId, status: "PUBLISHED", position: { lt: position } }, orderBy: { position: "desc" } }),
    prisma.contentPart.findFirst({ where: { contentId, status: "PUBLISHED", position: { gt: position } }, orderBy: { position: "asc" } }),
  ]);
  return { previousPart, nextPart };
}

export async function getAuthorBySlug(slug: string) {
  return prisma.creatorProfile.findFirst({ where: { slug, deletedAt: null } });
}

/** Every published item by this creator, across all ContentTypes — the author page groups them by `type`. */
export async function getAuthorItems(creatorId: string) {
  return prisma.content.findMany({
    where: { creatorId, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findFirst({
    where: { slug, deletedAt: null },
    include: { _count: { select: { contents: publicContentCountFilter } } },
  });
}

export async function getCategoryItems(categoryId: string, { limit = 24, offset = 0 } = {}) {
  const where = { status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null, categories: { some: { categoryId } } };
  const [items, total] = await Promise.all([
    prisma.content.findMany({ where, orderBy: { publishedAt: "desc" }, take: limit, skip: offset }),
    prisma.content.count({ where }),
  ]);
  return { items, total };
}

/**
 * "Liên quan" (spec: internal linking via real HTML <a>, no keyword
 * stuffing). Prefers same-type items sharing a category; falls back to the
 * same author when the item has no category yet. Always excludes itself,
 * and always stays within the same ContentType (a related "truyện" should
 * never surface a "tin tức").
 */
export async function getRelatedItems(type: ContentType, content: { id: string; creatorId: string; categoryIds: string[] }, limit = 6) {
  const where = publicWhere(type);
  if (content.categoryIds.length > 0) {
    const byCategory = await prisma.content.findMany({
      where: { ...where, id: { not: content.id }, categories: { some: { categoryId: { in: content.categoryIds } } } },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
    if (byCategory.length > 0) return byCategory;
  }

  return prisma.content.findMany({
    where: { ...where, id: { not: content.id }, creatorId: content.creatorId },
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

export async function getTagItems(tagId: string) {
  return prisma.content.findMany({
    where: { status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, tags: { some: { tagId } } },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getHomepageData() {
  const [popularCategories, creators] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, take: 8 }),
    prisma.creatorProfile.findMany({ where: { deletedAt: null, contents: { some: { status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } } }, take: 6 }),
  ]);
  return { popularCategories, creators };
}

/** Latest published items of one type, for the homepage's per-type section. */
export async function getLatestItems(type: ContentType, limit = 12) {
  return prisma.content.findMany({ where: publicWhere(type), orderBy: { publishedAt: "desc" }, take: limit, include: { creator: true } });
}

export async function listPublishedItems(
  type: ContentType,
  { limit = 24, offset = 0, categorySlug, tagSlug }: { limit?: number; offset?: number; categorySlug?: string; tagSlug?: string },
) {
  const where = {
    ...publicWhere(type),
    ...(categorySlug ? { categories: { some: { category: { slug: categorySlug } } } } : {}),
    ...(tagSlug ? { tags: { some: { tag: { slug: tagSlug } } } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.content.findMany({ where, orderBy: { publishedAt: "desc" }, take: limit, skip: offset, include: { creator: true } }),
    prisma.content.count({ where }),
  ]);
  return { items, total };
}

/** "Tin mới nhất khác" — most recent other items of the same type, excluding itself. */
export async function getRecentItems(type: ContentType, excludeId: string, limit = 6) {
  return prisma.content.findMany({
    where: { ...publicWhere(type), id: { not: excludeId } },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export type { ContentTypeConfig };
