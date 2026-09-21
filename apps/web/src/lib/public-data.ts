import { prisma } from "@contenthub/database";

const publicStoryWhere = { type: "STORY" as const, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };

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

export async function getPublishedChapters(contentId: string) {
  return prisma.contentPart.findMany({
    where: { contentId, status: "PUBLISHED", deletedAt: null },
    orderBy: { position: "asc" },
  });
}

export async function getChapter(contentId: string, chapterSlug: string) {
  return prisma.contentPart.findFirst({ where: { contentId, slug: chapterSlug } });
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
  return prisma.category.findFirst({ where: { slug, deletedAt: null } });
}

export async function getCategoryStories(categoryId: string, { limit = 24, offset = 0 } = {}) {
  const where = { ...publicStoryWhere, categories: { some: { categoryId } } };
  const [items, total] = await Promise.all([
    prisma.content.findMany({ where, orderBy: { publishedAt: "desc" }, take: limit, skip: offset }),
    prisma.content.count({ where }),
  ]);
  return { items, total };
}

export async function getTagBySlug(slug: string) {
  return prisma.tag.findFirst({ where: { slug, deletedAt: null }, include: { _count: { select: { contents: true } } } });
}

export async function getTagStories(tagId: string) {
  return prisma.content.findMany({
    where: { ...publicStoryWhere, tags: { some: { tagId } } },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getHomepageData() {
  const [latest, popularCategories, creators] = await Promise.all([
    prisma.content.findMany({ where: publicStoryWhere, orderBy: { publishedAt: "desc" }, take: 12, include: { creator: true } }),
    prisma.category.findMany({ where: { deletedAt: null }, take: 8 }),
    prisma.creatorProfile.findMany({ where: { deletedAt: null, contents: { some: publicStoryWhere } }, take: 6 }),
  ]);
  return { latest, popularCategories, creators };
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
