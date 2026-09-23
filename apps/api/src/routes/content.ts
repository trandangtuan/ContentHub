import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { slugify, disambiguateSlug, countWords, estimateReadingTimeMinutes, htmlToPlainText } from "@contenthub/shared";
import { buildSlugChangeRedirect, paths, SINGLE_PART_SLUG, type ContentTypeConfig } from "@contenthub/seo";
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from "../errors.js";

const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(300).optional(),
  coverImage: z.string().url().optional(),
  language: z.string().min(2).max(10).default("vi"),
  categoryIds: z.array(z.string().uuid()).max(5).optional(),
  /** Type-specific scalar metadata (e.g. STORY's {subtitle, ageRating}) — packages/database's Content.attributes. */
  attributes: z.record(z.string(), z.unknown()).optional(),
  /** Only meaningful for a "single" partsMode type — ignored otherwise. */
  bodyHtml: z.string().max(500_000).optional(),
  bodyJson: z.unknown().optional(),
});

const updateItemSchema = createItemSchema.partial().extend({
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
});

const createPartSchema = z.object({
  title: z.string().min(1).max(200),
  bodyHtml: z.string().max(500_000).default(""),
  bodyJson: z.unknown().optional(),
});

const updatePartSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().max(500_000).optional(),
  bodyJson: z.unknown().optional(),
});

const publishPartSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
});

async function uniqueSlug(baseTitle: string, check: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(baseTitle);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = disambiguateSlug(base, attempt);
    if (await check(candidate)) return candidate;
  }
  throw new ConflictError("Could not generate a unique slug");
}

async function requireExistingCategories(categoryIds: string[]) {
  if (categoryIds.length === 0) return;
  const found = await prisma.category.findMany({ where: { id: { in: categoryIds }, deletedAt: null } });
  if (found.length !== categoryIds.length) throw new ValidationError("One or more categories do not exist");
}

/**
 * Registers every creator-facing route for one ContentType (packages/seo's
 * registry) — list/get/create/update/publish/unpublish/delete, plus (for a
 * "multi" partsMode type) the same for its parts (chapters). Called once per
 * registry entry from app.ts: a new type that fits one of the two existing
 * shapes needs zero new route code, only a new registry entry.
 */
export function registerContentTypeRoutes(app: FastifyInstance, config: ContentTypeConfig) {
  const { type, apiResource, partsApiResource, partsMode } = config;

  async function requireOwnedItem(userSession: { userId: string; creatorProfileId: string | null; role: string }, id: string) {
    const content = await prisma.content.findUnique({ where: { id }, include: { categories: { include: { category: true } } } });
    if (!content || content.deletedAt || content.type !== type) throw new NotFoundError(`${config.label} not found`);
    const isOwner = userSession.creatorProfileId === content.creatorId;
    const isPrivileged = userSession.role === "ADMIN" || userSession.role === "MODERATOR";
    if (!isOwner && !isPrivileged) throw new ForbiddenError();
    return content;
  }

  async function requireOwnedPart(userSession: { userId: string; creatorProfileId: string | null; role: string }, partId: string) {
    const part = await prisma.contentPart.findUnique({ where: { id: partId } });
    if (!part || part.deletedAt) throw new NotFoundError(`${config.partLabel ?? "Part"} not found`);
    await requireOwnedItem(userSession, part.contentId);
    return part;
  }

  // ── Items (Content) ──────────────────────────────────────────────────
  app.get(`/creator/${apiResource}`, async (request) => {
    const session = app.requireAuth(request);
    if (!session.creatorProfileId) return { [apiResource]: [] };

    const items = await prisma.content.findMany({
      where: { creatorId: session.creatorProfileId, type, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        categories: { include: { category: true } },
        _count: { select: { parts: true } },
        parts: partsMode === "single" ? { where: { deletedAt: null } } : false,
      },
    });

    return { [apiResource]: items };
  });

  app.get(`/creator/${apiResource}/:id`, async (request) => {
    const session = app.requireAuth(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedItem(session, id);
    if (partsMode !== "single") return content;
    const parts = await prisma.contentPart.findMany({ where: { contentId: id, deletedAt: null } });
    return { ...content, parts };
  });

  if (partsMode === "multi" && partsApiResource) {
    app.get(`/creator/${apiResource}/:id/${partsApiResource}`, async (request) => {
      const session = app.requireAuth(request);
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await requireOwnedItem(session, id);

      const parts = await prisma.contentPart.findMany({ where: { contentId: id, deletedAt: null }, orderBy: { position: "asc" } });
      return { [partsApiResource]: parts };
    });
  }

  app.post(`/creator/${apiResource}`, async (request, reply) => {
    const session = app.requireRole(request, "CREATOR");
    app.requireCsrf(request);
    if (!session.creatorProfileId) throw new ForbiddenError("Create a creator profile first");

    const body = createItemSchema.parse(request.body);
    await requireExistingCategories(body.categoryIds ?? []);
    const slug = await uniqueSlug(body.title, async (candidate) => !(await prisma.content.findUnique({ where: { slug: candidate } })));

    let wordCount = 0;
    if (partsMode === "single") wordCount = countWords(htmlToPlainText(body.bodyHtml ?? ""));

    const content = await prisma.content.create({
      data: {
        creatorId: session.creatorProfileId,
        type,
        title: body.title,
        slug,
        description: body.description,
        shortDescription: body.shortDescription,
        coverImage: body.coverImage,
        language: body.language,
        status: "DRAFT",
        visibility: "PRIVATE",
        attributes: body.attributes as never,
        categories: body.categoryIds ? { create: body.categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
        parts:
          partsMode === "single"
            ? {
                create: {
                  title: body.title,
                  slug: SINGLE_PART_SLUG,
                  position: 1,
                  bodyHtml: body.bodyHtml ?? "",
                  bodyJson: body.bodyJson as never,
                  wordCount,
                  readingTimeMinutes: estimateReadingTimeMinutes(wordCount),
                  status: "DRAFT",
                },
              }
            : undefined,
      },
      include: { categories: { include: { category: true } }, parts: partsMode === "single" },
    });

    reply.status(201).send(content);
  });

  app.patch(`/creator/${apiResource}/:id`, async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedItem(session, id);
    const body = updateItemSchema.parse(request.body);
    if (body.categoryIds) await requireExistingCategories(body.categoryIds);

    let newSlug: string | undefined;
    if (body.title && body.title !== content.title) {
      newSlug = await uniqueSlug(body.title, async (candidate) => !(await prisma.content.findUnique({ where: { slug: candidate } })));
    }

    const wordCount = partsMode === "single" && body.bodyHtml !== undefined ? countWords(htmlToPlainText(body.bodyHtml)) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      if (newSlug) {
        await tx.redirect.create({ data: { ...buildSlugChangeRedirect(paths.item(config.urlPrefix, content.slug), paths.item(config.urlPrefix, newSlug)), contentId: content.id } });
      }
      if (body.categoryIds) {
        await tx.contentCategory.deleteMany({ where: { contentId: id } });
      }

      if (partsMode === "single" && (body.bodyHtml !== undefined || newSlug || body.title)) {
        const part = await tx.contentPart.findFirst({ where: { contentId: id, slug: SINGLE_PART_SLUG } });
        if (part) {
          const updatedPart = await tx.contentPart.update({
            where: { id: part.id },
            data: {
              title: body.title ?? undefined,
              bodyHtml: body.bodyHtml,
              bodyJson: body.bodyJson as never,
              wordCount,
              readingTimeMinutes: wordCount !== undefined ? estimateReadingTimeMinutes(wordCount) : undefined,
            },
          });
          if (body.bodyHtml !== undefined) {
            const lastVersion = await tx.contentVersion.aggregate({ where: { contentPartId: part.id }, _max: { versionNumber: true } });
            await tx.contentVersion.create({
              data: {
                contentPartId: part.id,
                versionNumber: (lastVersion._max.versionNumber ?? 0) + 1,
                bodyHtml: updatedPart.bodyHtml,
                bodyJson: updatedPart.bodyJson as never,
                wordCount: updatedPart.wordCount,
                createdById: session.userId,
              },
            });
          }
        }
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
          attributes: body.attributes as never,
          categories: body.categoryIds ? { create: body.categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
        },
        include: { categories: { include: { category: true } }, parts: partsMode === "single" },
      });
    });

    return updated;
  });

  app.post(`/creator/${apiResource}/:id/publish`, async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedItem(session, id);

    if (partsMode === "single") {
      const part = await prisma.contentPart.findFirst({ where: { contentId: id, slug: SINGLE_PART_SLUG } });
      if (!content.title || !part?.bodyHtml?.trim()) throw new ValidationError("Title and content are required before publishing");
    } else if (!content.title || !content.description) {
      throw new ValidationError("Title and description are required before publishing");
    }

    return prisma.$transaction(async (tx) => {
      if (partsMode === "single") {
        await tx.contentPart.updateMany({ where: { contentId: id, slug: SINGLE_PART_SLUG }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      }
      return tx.content.update({
        where: { id },
        data: { status: "PUBLISHED", visibility: "PUBLIC", publishedAt: content.publishedAt ?? new Date() },
        include: { categories: { include: { category: true } }, parts: partsMode === "single" },
      });
    });
  });

  app.post(`/creator/${apiResource}/:id/unpublish`, async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedItem(session, id);

    return prisma.$transaction(async (tx) => {
      if (partsMode === "single") {
        await tx.contentPart.updateMany({ where: { contentId: id, slug: SINGLE_PART_SLUG }, data: { status: "UNPUBLISHED" } });
      }
      return tx.content.update({ where: { id }, data: { status: "UNPUBLISHED" } });
    });
  });

  app.delete(`/creator/${apiResource}/:id`, async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedItem(session, id);

    await prisma.$transaction(async (tx) => {
      if (partsMode === "single") {
        await tx.contentPart.updateMany({ where: { contentId: id, slug: SINGLE_PART_SLUG }, data: { deletedAt: new Date(), status: "UNPUBLISHED" } });
      }
      await tx.content.update({ where: { id }, data: { deletedAt: new Date(), status: "UNPUBLISHED" } });
    });
    reply.status(204).send();
  });

  // ── Parts (ContentPart) — only for a "multi" partsMode type ────────────
  if (partsMode !== "multi" || !partsApiResource) return;

  app.get(`/creator/${partsApiResource}/:id`, async (request) => {
    const session = app.requireAuth(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return requireOwnedPart(session, id);
  });

  app.post(`/creator/${apiResource}/:id/${partsApiResource}`, async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedItem(session, id);

    const body = createPartSchema.parse(request.body);
    const wordCount = countWords(htmlToPlainText(body.bodyHtml));

    const slug = await uniqueSlug(body.title, async (candidate) => !(await prisma.contentPart.findUnique({ where: { contentId_slug: { contentId: id, slug: candidate } } })));
    const maxPosition = await prisma.contentPart.aggregate({ where: { contentId: id }, _max: { position: true } });

    const part = await prisma.$transaction(async (tx) => {
      const created = await tx.contentPart.create({
        data: {
          contentId: id,
          title: body.title,
          slug,
          position: (maxPosition._max.position ?? 0) + 1,
          bodyHtml: body.bodyHtml,
          bodyJson: body.bodyJson as never,
          wordCount,
          readingTimeMinutes: estimateReadingTimeMinutes(wordCount),
          status: "DRAFT",
        },
      });

      // Seed revision 1 so every saved state (including the first) is in the history.
      await tx.contentVersion.create({
        data: {
          contentPartId: created.id,
          versionNumber: 1,
          bodyHtml: created.bodyHtml,
          bodyJson: created.bodyJson as never,
          wordCount: created.wordCount,
          createdById: session.userId,
        },
      });

      return created;
    });

    reply.status(201).send(part);
  });

  app.patch(`/creator/${partsApiResource}/:id`, async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedPart(session, id);

    const body = updatePartSchema.parse(request.body);
    const wordCount = body.bodyHtml !== undefined ? countWords(htmlToPlainText(body.bodyHtml)) : undefined;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.contentPart.update({
        where: { id },
        data: {
          title: body.title,
          bodyHtml: body.bodyHtml,
          bodyJson: body.bodyJson as never,
          wordCount,
          readingTimeMinutes: wordCount !== undefined ? estimateReadingTimeMinutes(wordCount) : undefined,
        },
      });

      // Revision history (autosave -> content_versions), per docs/ARCHITECTURE.md editor spec.
      if (body.bodyHtml !== undefined) {
        const lastVersion = await tx.contentVersion.aggregate({ where: { contentPartId: id }, _max: { versionNumber: true } });
        await tx.contentVersion.create({
          data: {
            contentPartId: id,
            versionNumber: (lastVersion._max.versionNumber ?? 0) + 1,
            bodyHtml: updated.bodyHtml,
            bodyJson: updated.bodyJson as never,
            wordCount: updated.wordCount,
            createdById: session.userId,
          },
        });
      }

      return updated;
    });
  });

  app.post(`/creator/${partsApiResource}/:id/publish`, async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = publishPartSchema.parse(request.body ?? {});
    await requireOwnedPart(session, id);

    if (body.scheduledAt) {
      // Data model + status only — flipping SCHEDULED -> PUBLISHED at the target
      // time is a worker responsibility (docs/ARCHITECTURE.md, Phase 5+ backlog).
      return prisma.contentPart.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt: new Date(body.scheduledAt) } });
    }

    return prisma.contentPart.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  });

  app.post(`/creator/${partsApiResource}/:id/unpublish`, async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedPart(session, id);

    return prisma.contentPart.update({ where: { id }, data: { status: "UNPUBLISHED" } });
  });

  app.delete(`/creator/${partsApiResource}/:id`, async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedPart(session, id);

    // Soft delete (matches the Content-level pattern in packages/moderation):
    // unpublish first so it drops out of the public reader/sitemap immediately,
    // deletedAt keeps it out of every creator-facing list/query going forward.
    await prisma.contentPart.update({ where: { id }, data: { deletedAt: new Date(), status: "UNPUBLISHED" } });
    reply.status(204).send();
  });
}
