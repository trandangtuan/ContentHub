import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { loadSeoConfigFromEnv, SINGLE_PART_SLUG, type ContentTypeConfig } from "@contenthub/seo";
import { PostgresSearchProvider } from "@contenthub/search";
import { NotFoundError, GoneError } from "../errors.js";
import { serializePublicContent } from "../serializers.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  tag: z.string().optional(),
});

const contentInclude = { creator: true, categories: { include: { category: true } }, tags: { include: { tag: true } } } as const;

/**
 * Registers every public (unauthenticated) route for one ContentType
 * (packages/seo's registry): list, detail, and — for a "multi" partsMode
 * type — its parts list + part detail. A new type reuses this unchanged.
 */
export function registerPublicContentTypeRoutes(app: FastifyInstance, config: ContentTypeConfig) {
  const siteUrl = loadSeoConfigFromEnv().siteUrl;
  const { type, apiResource, partsApiResource, partsMode } = config;

  app.get(`/public/${apiResource}`, async (request) => {
    const query = listQuerySchema.parse(request.query);

    const where = {
      type,
      status: "PUBLISHED" as const,
      visibility: "PUBLIC" as const,
      deletedAt: null,
      ...(query.category ? { categories: { some: { category: { slug: query.category } } } } : {}),
      ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.content.findMany({ where, orderBy: { publishedAt: "desc" }, take: query.limit, skip: query.offset, include: contentInclude }),
      prisma.content.count({ where }),
    ]);

    return {
      items: items.map((c) => serializePublicContent(c, config, siteUrl)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  app.get(`/public/${apiResource}/:slug`, async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const content = await prisma.content.findFirst({ where: { slug, type }, include: contentInclude });
    if (!content) throw new NotFoundError(`${config.label} not found`);
    if (content.deletedAt) throw new GoneError(`This ${config.itemLabel} has been removed`);
    if (content.status !== "PUBLISHED" || content.visibility !== "PUBLIC") throw new NotFoundError(`${config.label} not found`);

    const parts = await prisma.contentPart.findMany({ where: { contentId: content.id, status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" } });
    return serializePublicContent(content, config, siteUrl, parts);
  });

  if (partsMode !== "multi" || !partsApiResource) return;

  app.get(`/public/${apiResource}/:slug/${partsApiResource}`, async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const content = await prisma.content.findFirst({ where: { slug, type, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } });
    if (!content) throw new NotFoundError(`${config.label} not found`);

    const parts = await prisma.contentPart.findMany({
      where: { contentId: content.id, status: "PUBLISHED", deletedAt: null },
      orderBy: { position: "asc" },
      select: { slug: true, title: true, position: true, publishedAt: true, wordCount: true, readingTimeMinutes: true },
    });

    return { itemSlug: slug, [partsApiResource]: parts };
  });

  app.get(`/public/${apiResource}/:itemSlug/${partsApiResource}/:partSlug`, async (request) => {
    const params = z.object({ itemSlug: z.string(), partSlug: z.string() }).parse(request.params);

    const content = await prisma.content.findFirst({ where: { slug: params.itemSlug, type }, include: { creator: true } });
    if (!content) throw new NotFoundError(`${config.label} not found`);
    if (content.deletedAt) throw new GoneError(`This ${config.itemLabel} has been removed`);
    if (content.status !== "PUBLISHED" || content.visibility !== "PUBLIC") throw new NotFoundError(`${config.label} not found`);

    const part = await prisma.contentPart.findFirst({ where: { contentId: content.id, slug: params.partSlug } });
    if (!part || part.slug === SINGLE_PART_SLUG) throw new NotFoundError(`${config.partLabel ?? "Part"} not found`);
    if (part.deletedAt) throw new GoneError(`This ${config.partLabel ?? "part"} has been removed`);
    if (part.status !== "PUBLISHED") throw new NotFoundError(`${config.partLabel ?? "Part"} not found`);

    const [prev, next] = await Promise.all([
      prisma.contentPart.findFirst({ where: { contentId: content.id, status: "PUBLISHED", position: { lt: part.position } }, orderBy: { position: "desc" } }),
      prisma.contentPart.findFirst({ where: { contentId: content.id, status: "PUBLISHED", position: { gt: part.position } }, orderBy: { position: "asc" } }),
    ]);

    return {
      id: part.id,
      title: part.title,
      slug: part.slug,
      position: part.position,
      bodyHtml: part.bodyHtml,
      wordCount: part.wordCount,
      readingTimeMinutes: part.readingTimeMinutes,
      publishedAt: part.publishedAt,
      item: { slug: content.slug, title: content.title },
      author: { slug: content.creator.slug, name: content.creator.displayName },
      previousPart: prev ? { slug: prev.slug, title: prev.title } : null,
      nextPart: next ? { slug: next.slug, title: next.title } : null,
    };
  });
}

/** Routes that aren't specific to any one ContentType: authors, categories, tags, search. */
export function registerPublicRoutes(app: FastifyInstance) {
  const siteUrl = loadSeoConfigFromEnv().siteUrl;
  const searchProvider = new PostgresSearchProvider(prisma);

  app.get("/public/authors/:slug", async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const creator = await prisma.creatorProfile.findFirst({ where: { slug, deletedAt: null } });
    if (!creator) throw new NotFoundError("Author not found");

    const [items, followerCount] = await Promise.all([
      prisma.content.findMany({
        where: { creatorId: creator.id, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null },
        orderBy: { publishedAt: "desc" },
        select: { slug: true, title: true, type: true, coverImage: true, shortDescription: true, publishedAt: true },
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
      stories: items,
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
        select: { slug: true, title: true, type: true, coverImage: true, shortDescription: true, publishedAt: true },
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
      select: { slug: true, title: true, type: true, coverImage: true, shortDescription: true, publishedAt: true },
    });

    return { slug: tag.slug, name: tag.name, items, isIndexable: items.length >= 2 };
  });

  app.get("/public/search", async (request) => {
    const query = z.object({ q: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(request.query);
    return searchProvider.search({ text: query.q, limit: query.limit });
  });
}
