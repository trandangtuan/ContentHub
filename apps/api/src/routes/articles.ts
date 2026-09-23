import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { slugify, disambiguateSlug, countWords, estimateReadingTimeMinutes, htmlToPlainText } from "@contenthub/shared";
import { buildSlugChangeRedirect } from "@contenthub/seo";
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from "../errors.js";

const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  shortDescription: z.string().max(300).optional(),
  coverImage: z.string().url().optional(),
  language: z.string().min(2).max(10).default("vi"),
  bodyHtml: z.string().max(200_000).default(""),
  bodyJson: z.unknown().optional(),
});

const updateArticleSchema = createArticleSchema.partial().extend({
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
});

async function uniqueSlug(baseTitle: string, check: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(baseTitle);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = disambiguateSlug(base, attempt);
    if (await check(candidate)) return candidate;
  }
  throw new ConflictError("Could not generate a unique slug");
}

async function requireOwnedArticle(userSession: { userId: string; creatorProfileId: string | null; role: string }, articleId: string) {
  const content = await prisma.content.findUnique({ where: { id: articleId }, include: { article: true } });
  if (!content || content.deletedAt || content.type !== "ARTICLE") throw new NotFoundError("Article not found");
  const isOwner = userSession.creatorProfileId === content.creatorId;
  const isPrivileged = userSession.role === "ADMIN" || userSession.role === "MODERATOR";
  if (!isOwner && !isPrivileged) throw new ForbiddenError();
  return content;
}

/**
 * "Tin tức" (daily news posts) — Content.type = ARTICLE. Unlike a Story, an
 * article's body lives directly on the 1:1 Article extension table (no
 * ContentPart/chapters): a news post is one unit, published and done, not a
 * serialized set of chapters (docs/ARCHITECTURE.md's Content polymorphism —
 * "adding ARTICLE later means adding a new extension table, not rewriting
 * Content/ContentPart/View/Revenue").
 */
export function registerArticleRoutes(app: FastifyInstance) {
  app.get("/creator/articles", async (request) => {
    const session = app.requireAuth(request);
    if (!session.creatorProfileId) return { articles: [] };

    const articles = await prisma.content.findMany({
      where: { creatorId: session.creatorProfileId, type: "ARTICLE", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { article: true },
    });

    return { articles };
  });

  app.get("/creator/articles/:id", async (request) => {
    const session = app.requireAuth(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return requireOwnedArticle(session, id);
  });

  app.post("/creator/articles", async (request, reply) => {
    const session = app.requireRole(request, "CREATOR");
    app.requireCsrf(request);
    if (!session.creatorProfileId) throw new ForbiddenError("Create a creator profile first");

    const body = createArticleSchema.parse(request.body);
    const slug = await uniqueSlug(body.title, async (candidate) => !(await prisma.content.findUnique({ where: { slug: candidate } })));
    const wordCount = countWords(htmlToPlainText(body.bodyHtml));

    const content = await prisma.content.create({
      data: {
        creatorId: session.creatorProfileId,
        type: "ARTICLE",
        title: body.title,
        slug,
        description: body.description,
        shortDescription: body.shortDescription,
        coverImage: body.coverImage,
        language: body.language,
        status: "DRAFT",
        visibility: "PRIVATE",
        article: {
          create: {
            bodyHtml: body.bodyHtml,
            bodyJson: body.bodyJson as never,
            wordCount,
            readingTimeMinutes: estimateReadingTimeMinutes(wordCount),
          },
        },
      },
      include: { article: true },
    });

    reply.status(201).send(content);
  });

  app.patch("/creator/articles/:id", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedArticle(session, id);
    const body = updateArticleSchema.parse(request.body);

    let newSlug: string | undefined;
    if (body.title && body.title !== content.title) {
      newSlug = await uniqueSlug(body.title, async (candidate) => !(await prisma.content.findUnique({ where: { slug: candidate } })));
    }

    const wordCount = body.bodyHtml !== undefined ? countWords(htmlToPlainText(body.bodyHtml)) : undefined;

    return prisma.$transaction(async (tx) => {
      if (newSlug) {
        await tx.redirect.create({ data: { ...buildSlugChangeRedirect(`/tin-tuc/${content.slug}`, `/tin-tuc/${newSlug}`), contentId: content.id } });
      }

      return tx.content.update({
        where: { id },
        data: {
          title: body.title,
          slug: newSlug,
          description: body.description,
          shortDescription: body.shortDescription,
          language: body.language,
          coverImage: body.coverImage,
          visibility: body.visibility,
          article: {
            update: {
              bodyHtml: body.bodyHtml,
              bodyJson: body.bodyJson as never,
              wordCount,
              readingTimeMinutes: wordCount !== undefined ? estimateReadingTimeMinutes(wordCount) : undefined,
            },
          },
        },
        include: { article: true },
      });
    });
  });

  app.post("/creator/articles/:id/publish", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedArticle(session, id);

    if (!content.title || !content.article?.bodyHtml?.trim()) {
      throw new ValidationError("Title and content are required before publishing");
    }

    return prisma.content.update({
      where: { id },
      data: { status: "PUBLISHED", visibility: "PUBLIC", publishedAt: content.publishedAt ?? new Date() },
      include: { article: true },
    });
  });

  app.post("/creator/articles/:id/unpublish", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedArticle(session, id);

    return prisma.content.update({ where: { id }, data: { status: "UNPUBLISHED" } });
  });

  app.delete("/creator/articles/:id", async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedArticle(session, id);

    await prisma.content.update({ where: { id }, data: { deletedAt: new Date(), status: "UNPUBLISHED" } });
    reply.status(204).send();
  });
}
