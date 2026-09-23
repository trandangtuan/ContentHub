import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { loadSeoConfigFromEnv } from "@contenthub/seo";
import { PostgresSearchProvider } from "@contenthub/search";
import { NotFoundError, GoneError } from "../errors.js";
import { serializePublicStory, serializePublicArticle } from "../serializers.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  tag: z.string().optional(),
});

export function registerPublicRoutes(app: FastifyInstance) {
  const siteUrl = loadSeoConfigFromEnv().siteUrl;
  const searchProvider = new PostgresSearchProvider(prisma);

  app.get("/public/stories", async (request) => {
    const query = listQuerySchema.parse(request.query);

    const where = {
      type: "STORY" as const,
      status: "PUBLISHED" as const,
      visibility: "PUBLIC" as const,
      deletedAt: null,
      ...(query.category ? { categories: { some: { category: { slug: query.category } } } } : {}),
      ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        take: query.limit,
        skip: query.offset,
        include: { creator: true, story: true, categories: { include: { category: true } }, tags: { include: { tag: true } } },
      }),
      prisma.content.count({ where }),
    ]);

    return {
      items: items.map((c) => serializePublicStory(c, [], siteUrl)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  app.get("/public/stories/:slug", async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const content = await prisma.content.findFirst({
      where: { slug, type: "STORY" },
      include: { creator: true, story: true, categories: { include: { category: true } }, tags: { include: { tag: true } } },
    });

    if (!content) throw new NotFoundError("Story not found");
    if (content.deletedAt) throw new GoneError("This story has been removed");
    if (content.status !== "PUBLISHED" || content.visibility !== "PUBLIC") throw new NotFoundError("Story not found");

    const chapters = await prisma.contentPart.findMany({
      where: { contentId: content.id, status: "PUBLISHED", deletedAt: null },
      orderBy: { position: "asc" },
    });

    return serializePublicStory(content, chapters, siteUrl);
  });

  app.get("/public/stories/:slug/chapters", async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const content = await prisma.content.findFirst({ where: { slug, type: "STORY", status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } });
    if (!content) throw new NotFoundError("Story not found");

    const chapters = await prisma.contentPart.findMany({
      where: { contentId: content.id, status: "PUBLISHED", deletedAt: null },
      orderBy: { position: "asc" },
      select: { slug: true, title: true, position: true, publishedAt: true, wordCount: true, readingTimeMinutes: true },
    });

    return { storySlug: slug, chapters };
  });

  app.get("/public/stories/:storySlug/chapters/:chapterSlug", async (request) => {
    const params = z.object({ storySlug: z.string(), chapterSlug: z.string() }).parse(request.params);

    const content = await prisma.content.findFirst({
      where: { slug: params.storySlug, type: "STORY" },
      include: { creator: true },
    });
    if (!content) throw new NotFoundError("Story not found");
    if (content.deletedAt) throw new GoneError("This story has been removed");
    if (content.status !== "PUBLISHED" || content.visibility !== "PUBLIC") throw new NotFoundError("Story not found");

    const chapter = await prisma.contentPart.findFirst({ where: { contentId: content.id, slug: params.chapterSlug } });
    if (!chapter) throw new NotFoundError("Chapter not found");
    if (chapter.deletedAt) throw new GoneError("This chapter has been removed");
    if (chapter.status !== "PUBLISHED") throw new NotFoundError("Chapter not found");

    const [prev, next] = await Promise.all([
      prisma.contentPart.findFirst({ where: { contentId: content.id, status: "PUBLISHED", position: { lt: chapter.position } }, orderBy: { position: "desc" } }),
      prisma.contentPart.findFirst({ where: { contentId: content.id, status: "PUBLISHED", position: { gt: chapter.position } }, orderBy: { position: "asc" } }),
    ]);

    return {
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      position: chapter.position,
      bodyHtml: chapter.bodyHtml,
      wordCount: chapter.wordCount,
      readingTimeMinutes: chapter.readingTimeMinutes,
      publishedAt: chapter.publishedAt,
      story: { slug: content.slug, title: content.title },
      author: { slug: content.creator.slug, name: content.creator.displayName },
      previousChapter: prev ? { slug: prev.slug, title: prev.title } : null,
      nextChapter: next ? { slug: next.slug, title: next.title } : null,
    };
  });

  app.get("/public/articles", async (request) => {
    const query = listQuerySchema.parse(request.query);

    const where = { type: "ARTICLE" as const, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        take: query.limit,
        skip: query.offset,
        include: { creator: true, article: true },
      }),
      prisma.content.count({ where }),
    ]);

    return {
      items: items.map((c) => serializePublicArticle(c, siteUrl)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  app.get("/public/articles/:slug", async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const content = await prisma.content.findFirst({
      where: { slug, type: "ARTICLE" },
      include: { creator: true, article: true },
    });

    if (!content) throw new NotFoundError("Article not found");
    if (content.deletedAt) throw new GoneError("This article has been removed");
    if (content.status !== "PUBLISHED" || content.visibility !== "PUBLIC") throw new NotFoundError("Article not found");

    return serializePublicArticle(content, siteUrl);
  });

  app.get("/public/authors/:slug", async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const creator = await prisma.creatorProfile.findFirst({ where: { slug, deletedAt: null } });
    if (!creator) throw new NotFoundError("Author not found");

    const [stories, followerCount] = await Promise.all([
      prisma.content.findMany({
        where: { creatorId: creator.id, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null },
        orderBy: { publishedAt: "desc" },
        select: { slug: true, title: true, coverImage: true, shortDescription: true, publishedAt: true },
      }),
      prisma.follow.count({ where: { creatorId: creator.id } }),
    ]);

    return {
      slug: creator.slug,
      name: creator.displayName,
      bio: creator.bio,
      avatarUrl: creator.avatarUrl,
      isOrganization: creator.isOrganization,
      joinedAt: creator.createdAt,
      followerCount,
      stories,
      url: `${siteUrl}/tac-gia/${creator.slug}`,
    };
  });

  app.get("/public/categories/:slug", async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const query = listQuerySchema.parse(request.query);

    const category = await prisma.category.findFirst({ where: { slug, deletedAt: null } });
    if (!category) throw new NotFoundError("Category not found");

    const where = { status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null, categories: { some: { categoryId: category.id } } };

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        take: query.limit,
        skip: query.offset,
        select: { slug: true, title: true, coverImage: true, shortDescription: true, publishedAt: true },
      }),
      prisma.content.count({ where }),
    ]);

    return { slug: category.slug, name: category.name, description: category.description, items, total };
  });

  app.get("/public/tags/:slug", async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const tag = await prisma.tag.findFirst({ where: { slug, deletedAt: null } });
    if (!tag) throw new NotFoundError("Tag not found");

    const items = await prisma.content.findMany({
      where: { status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, tags: { some: { tagId: tag.id } } },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, title: true, coverImage: true, shortDescription: true, publishedAt: true },
    });

    return { slug: tag.slug, name: tag.name, items, isIndexable: items.length >= 2 };
  });

  app.get("/public/search", async (request) => {
    const query = z.object({ q: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(request.query);
    return searchProvider.search({ text: query.q, limit: query.limit });
  });
}
