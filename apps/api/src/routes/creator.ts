import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { slugify, disambiguateSlug } from "@contenthub/shared";
import { ConflictError, NotFoundError } from "../errors.js";

const createProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(2000).optional(),
});

const updateProfileSchema = z.object({
  bio: z.string().max(2000).optional(),
  avatarUrl: z.string().url().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50),
});

async function uniqueSlug(baseTitle: string, check: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(baseTitle);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = disambiguateSlug(base, attempt);
    if (await check(candidate)) return candidate;
  }
  throw new ConflictError("Could not generate a unique slug");
}

/**
 * Routes that aren't specific to any one ContentType: profile, the shared
 * category taxonomy, cross-type analytics/wallet. Per-type CRUD (stories,
 * articles, their chapters) lives in routes/content.ts, registered once per
 * packages/seo content-type registry entry.
 */
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

  app.patch("/creator/profile", async (request) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    if (!session.creatorProfileId) throw new NotFoundError("No creator profile yet");
    const body = updateProfileSchema.parse(request.body);

    return prisma.creatorProfile.update({ where: { id: session.creatorProfileId }, data: body });
  });

  // ── Categories ────────────────────────────────────────────────────────
  // Categories are a shared, global taxonomy (no per-creator ownership —
  // see packages/database schema): any creator can add, rename, or
  // (soft-)delete one, and the result is immediately visible to every
  // other creator too — same permissive model already established for
  // create, extended to update/delete rather than adding an ownership
  // model this taxonomy has never had.
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

  app.patch("/creator/categories/:id", async (request) => {
    app.requireRole(request, "CREATOR");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateCategorySchema.parse(request.body);

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Category not found");

    const slug =
      body.name === existing.name ? existing.slug : await uniqueSlug(body.name, async (candidate) => !(await prisma.category.findUnique({ where: { slug: candidate } })));

    return prisma.category.update({ where: { id }, data: { name: body.name, slug } });
  });

  app.delete("/creator/categories/:id", async (request, reply) => {
    app.requireRole(request, "CREATOR");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Category not found");

    // Soft delete: existing content keeps its content_categories rows (no
    // data loss), the category just stops appearing in the picker/taxonomy
    // pages — same convention as every other content-adjacent table.
    await prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    reply.status(204).send();
  });

  // ── Analytics / wallet (read-only; all figures computed server-side) ───
  // Cross-type on purpose: a creator's total reach spans every ContentType
  // they've published (stories AND articles), not just one.
  app.get("/creator/analytics", async (request) => {
    const session = app.requireAuth(request);
    if (!session.creatorProfileId) throw new NotFoundError("No creator profile yet");

    const items = await prisma.content.findMany({ where: { creatorId: session.creatorProfileId, deletedAt: null }, select: { id: true, title: true, slug: true, type: true } });
    const itemIds = items.map((i) => i.id);

    const views = await prisma.contentView.groupBy({
      by: ["contentId"],
      where: { contentId: { in: itemIds } },
      _sum: { rawViews: true, validViews: true, qualifiedViews: true, monetizedViews: true },
    });

    const followerCount = await prisma.follow.count({ where: { creatorId: session.creatorProfileId } });

    return {
      followerCount,
      items: items.map((item) => {
        const v = views.find((row) => row.contentId === item.id);
        return {
          id: item.id,
          title: item.title,
          slug: item.slug,
          type: item.type,
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
