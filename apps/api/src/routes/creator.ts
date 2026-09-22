import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { slugify, disambiguateSlug, countWords, estimateReadingTimeMinutes, htmlToPlainText } from "@contenthub/shared";
import { buildSlugChangeRedirect } from "@contenthub/seo";
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from "../errors.js";

const createProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(2000).optional(),
});

const createStorySchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(300).optional(),
  language: z.string().min(2).max(10).default("vi"),
  ageRating: z.string().max(10).optional(),
  categoryIds: z.array(z.string().uuid()).max(5).optional(),
});

const updateStorySchema = createStorySchema.partial().extend({
  coverImage: z.string().url().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
});

const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  bodyHtml: z.string().max(500_000).default(""),
  bodyJson: z.unknown().optional(),
});

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().max(500_000).optional(),
  bodyJson: z.unknown().optional(),
});

const publishChapterSchema = z.object({
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

async function requireOwnedStory(userSession: { userId: string; creatorProfileId: string | null; role: string }, storyId: string) {
  const content = await prisma.content.findUnique({ where: { id: storyId }, include: { story: true, categories: { include: { category: true } } } });
  if (!content || content.deletedAt) throw new NotFoundError("Story not found");
  const isOwner = userSession.creatorProfileId === content.creatorId;
  const isPrivileged = userSession.role === "ADMIN" || userSession.role === "MODERATOR";
  if (!isOwner && !isPrivileged) throw new ForbiddenError();
  return content;
}

async function requireExistingCategories(categoryIds: string[]) {
  if (categoryIds.length === 0) return;
  const found = await prisma.category.findMany({ where: { id: { in: categoryIds }, deletedAt: null } });
  if (found.length !== categoryIds.length) throw new ValidationError("One or more categories do not exist");
}

export function registerCreatorRoutes(app: FastifyInstance) {
  // ── Creator profile ──────────────────────────────────────────────────
  app.post("/creator/profile", async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const body = createProfileSchema.parse(request.body);

    const existing = await prisma.creatorProfile.findUnique({ where: { userId: session.userId } });
    if (existing) throw new ConflictError("You already have a creator profile");

    const slug = await uniqueSlug(body.displayName, async (candidate) => {
      const found = await prisma.creatorProfile.findUnique({ where: { slug: candidate } });
      return !found;
    });

    const [profile] = await prisma.$transaction([
      prisma.creatorProfile.create({ data: { userId: session.userId, slug, displayName: body.displayName, bio: body.bio } }),
      prisma.user.update({ where: { id: session.userId }, data: { role: "CREATOR" } }),
    ]);
    await prisma.wallet.create({ data: { creatorId: profile.id } });

    reply.status(201).send(profile);
  });

  app.get("/creator/me", async (request) => {
    const session = app.requireAuth(request);
    if (!session.creatorProfileId) throw new NotFoundError("No creator profile yet");
    return prisma.creatorProfile.findUniqueOrThrow({ where: { id: session.creatorProfileId } });
  });

  // ── Categories ────────────────────────────────────────────────────────
  // Categories are a shared, global taxonomy (no per-creator ownership —
  // see packages/database schema): any creator can add one, and it becomes
  // immediately available for every other creator to pick too.
  app.get("/creator/categories", async () => {
    const categories = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
    return { categories };
  });

  app.post("/creator/categories", async (request, reply) => {
    app.requireRole(request, "CREATOR");
    app.requireCsrf(request);
    const body = createCategorySchema.parse(request.body);

    const existing = await prisma.category.findFirst({ where: { name: { equals: body.name, mode: "insensitive" }, deletedAt: null } });
    if (existing) return existing;

    const slug = await uniqueSlug(body.name, async (candidate) => !(await prisma.category.findUnique({ where: { slug: candidate } })));
    const category = await prisma.category.create({ data: { name: body.name, slug } });
    reply.status(201).send(category);
  });

  // ── Stories ───────────────────────────────────────────────────────────
  app.get("/creator/stories", async (request) => {
    const session = app.requireAuth(request);
    if (!session.creatorProfileId) return { stories: [] };

    const stories = await prisma.content.findMany({
      where: { creatorId: session.creatorProfileId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { story: true, categories: { include: { category: true } }, _count: { select: { parts: true } } },
    });

    return { stories };
  });

  app.get("/creator/stories/:id", async (request) => {
    const session = app.requireAuth(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedStory(session, id);
    return content;
  });

  app.get("/creator/stories/:id/chapters", async (request) => {
    const session = app.requireAuth(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedStory(session, id);

    const chapters = await prisma.contentPart.findMany({ where: { contentId: id, deletedAt: null }, orderBy: { position: "asc" } });
    return { chapters };
  });

  app.get("/creator/chapters/:id", async (request) => {
    const session = app.requireAuth(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const part = await prisma.contentPart.findUnique({ where: { id } });
    if (!part || part.deletedAt) throw new NotFoundError("Chapter not found");
    await requireOwnedStory(session, part.contentId);

    return part;
  });

  app.post("/creator/stories", async (request, reply) => {
    const session = app.requireRole(request, "CREATOR");
    app.requireCsrf(request);
    if (!session.creatorProfileId) throw new ForbiddenError("Create a creator profile first");

    const body = createStorySchema.parse(request.body);
    await requireExistingCategories(body.categoryIds ?? []);
    const slug = await uniqueSlug(body.title, async (candidate) => !(await prisma.content.findUnique({ where: { slug: candidate } })));

    const content = await prisma.content.create({
      data: {
        creatorId: session.creatorProfileId,
        type: "STORY",
        title: body.title,
        slug,
        description: body.description,
        shortDescription: body.shortDescription,
        language: body.language,
        status: "DRAFT",
        visibility: "PRIVATE",
        story: { create: { subtitle: body.subtitle, ageRating: body.ageRating } },
        categories: body.categoryIds ? { create: body.categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
      },
      include: { story: true, categories: { include: { category: true } } },
    });

    reply.status(201).send(content);
  });

  app.patch("/creator/stories/:id", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedStory(session, id);
    const body = updateStorySchema.parse(request.body);
    if (body.categoryIds) await requireExistingCategories(body.categoryIds);

    let newSlug: string | undefined;
    if (body.title && body.title !== content.title) {
      newSlug = await uniqueSlug(body.title, async (candidate) => !(await prisma.content.findUnique({ where: { slug: candidate } })));
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (newSlug) {
        await tx.redirect.create({ data: buildSlugChangeRedirect(`/truyen/${content.slug}`, `/truyen/${newSlug}`) });
      }
      if (body.categoryIds) {
        await tx.contentCategory.deleteMany({ where: { contentId: id } });
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
          story: body.subtitle || body.ageRating ? { update: { subtitle: body.subtitle, ageRating: body.ageRating } } : undefined,
          categories: body.categoryIds ? { create: body.categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
        },
        include: { story: true, categories: { include: { category: true } } },
      });
    });

    return updated;
  });

  app.post("/creator/stories/:id/publish", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await requireOwnedStory(session, id);

    if (!content.title || !content.description) {
      throw new ValidationError("Title and description are required before publishing");
    }

    return prisma.content.update({
      where: { id },
      data: { status: "PUBLISHED", visibility: "PUBLIC", publishedAt: content.publishedAt ?? new Date() },
    });
  });

  app.post("/creator/stories/:id/unpublish", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedStory(session, id);

    return prisma.content.update({ where: { id }, data: { status: "UNPUBLISHED" } });
  });

  // ── Chapters (ContentPart) ──────────────────────────────────────────────
  app.post("/creator/stories/:id/chapters", async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await requireOwnedStory(session, id);

    const body = createChapterSchema.parse(request.body);
    const plainText = htmlToPlainText(body.bodyHtml);
    const wordCount = countWords(plainText);

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

  app.patch("/creator/chapters/:id", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const part = await prisma.contentPart.findUnique({ where: { id } });
    if (!part || part.deletedAt) throw new NotFoundError("Chapter not found");
    await requireOwnedStory(session, part.contentId);

    const body = updateChapterSchema.parse(request.body);
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

  app.post("/creator/chapters/:id/publish", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = publishChapterSchema.parse(request.body ?? {});

    const part = await prisma.contentPart.findUnique({ where: { id } });
    if (!part || part.deletedAt) throw new NotFoundError("Chapter not found");
    await requireOwnedStory(session, part.contentId);

    if (body.scheduledAt) {
      // Data model + status only — flipping SCHEDULED -> PUBLISHED at the target
      // time is a worker responsibility (docs/ARCHITECTURE.md, Phase 5+ backlog).
      return prisma.contentPart.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt: new Date(body.scheduledAt) } });
    }

    return prisma.contentPart.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  });

  app.post("/creator/chapters/:id/unpublish", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const part = await prisma.contentPart.findUnique({ where: { id } });
    if (!part || part.deletedAt) throw new NotFoundError("Chapter not found");
    await requireOwnedStory(session, part.contentId);

    return prisma.contentPart.update({ where: { id }, data: { status: "UNPUBLISHED" } });
  });

  // ── Analytics / wallet (read-only; all figures computed server-side) ───
  app.get("/creator/analytics", async (request) => {
    const session = app.requireAuth(request);
    if (!session.creatorProfileId) throw new NotFoundError("No creator profile yet");

    const stories = await prisma.content.findMany({ where: { creatorId: session.creatorProfileId, deletedAt: null }, select: { id: true, title: true, slug: true } });
    const storyIds = stories.map((s) => s.id);

    const views = await prisma.contentView.groupBy({
      by: ["contentId"],
      where: { contentId: { in: storyIds } },
      _sum: { rawViews: true, validViews: true, qualifiedViews: true, monetizedViews: true },
    });

    const followerCount = await prisma.follow.count({ where: { creatorId: session.creatorProfileId } });

    return {
      followerCount,
      stories: stories.map((story) => {
        const v = views.find((row) => row.contentId === story.id);
        return {
          id: story.id,
          title: story.title,
          slug: story.slug,
          rawViews: v?._sum.rawViews ?? 0,
          qualifiedViews: v?._sum.qualifiedViews ?? 0,
          monetizedViews: v?._sum.monetizedViews ?? 0,
        };
      }),
    };
  });

  app.get("/creator/wallet", async (request) => {
    const session = app.requireAuth(request);
    if (!session.creatorProfileId) throw new NotFoundError("No creator profile yet");

    const wallet = await prisma.wallet.findUnique({ where: { creatorId: session.creatorProfileId } });
    if (!wallet) return { availableCents: "0", pendingCents: "0", paidCents: "0", currency: "VND", transactions: [] };

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Labeled explicitly as estimated/pending/finalized — never a bare guaranteed number (spec #39, #71).
    return {
      availableCents: wallet.balanceAvailableCents.toString(),
      pendingCents: wallet.balancePendingCents.toString(),
      paidCents: wallet.balancePaidCents.toString(),
      currency: wallet.currency,
      transactions: transactions.map((t) => ({
        type: t.type,
        amountCents: t.amountCents.toString(),
        balanceAfterCents: t.balanceAfterCents.toString(),
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  });
}
