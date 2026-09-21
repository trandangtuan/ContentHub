import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { applyModerationAction, createModerationReport, transitionReportStatus, InvalidReportTransitionError } from "@contenthub/moderation";
import { WalletLedger } from "@contenthub/revenue";
import { NotFoundError, ConflictError, ValidationError } from "../errors.js";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Admin dashboard API (spec #40, #75): Users/Creators/Stories/Chapters/
 * Reports/Moderation/Revenue/Payouts/SEO. Every route requires at least
 * MODERATOR; financial and account-status actions (suspend, revenue
 * config, wallet adjustment, payout status) require ADMIN. Every state
 * change here either goes through packages/moderation's
 * applyModerationAction (which always writes a moderation_actions audit
 * row first) or packages/revenue's WalletLedger (which always writes an
 * immutable wallet_transactions row) — there is no "just update the row"
 * path for anything that matters (spec #40: "Mọi adjustment tài chính phải
 * có audit log").
 */
export function registerAdminRoutes(app: FastifyInstance) {
  const ledger = new WalletLedger(prisma);

  // ── Overview ────────────────────────────────────────────────────────
  app.get("/admin/stats", async (request) => {
    app.requireRole(request, "MODERATOR");

    const [users, creators, stories, chapters, openReports, pendingPayouts] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.creatorProfile.count({ where: { deletedAt: null } }),
      prisma.content.count({ where: { deletedAt: null } }),
      prisma.contentPart.count({ where: { deletedAt: null } }),
      prisma.moderationReport.count({ where: { status: "OPEN" } }),
      prisma.payout.count({ where: { status: "PENDING" } }),
    ]);

    return { users, creators, stories, chapters, openReports, pendingPayouts };
  });

  // ── Users ───────────────────────────────────────────────────────────
  app.get("/admin/users", async (request) => {
    app.requireRole(request, "MODERATOR");
    const query = paginationSchema
      .extend({
        status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
        role: z.enum(["READER", "CREATOR", "MODERATOR", "ADMIN"]).optional(),
        q: z.string().optional(),
      })
      .parse(request.query);

    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.q ? { email: { contains: query.q, mode: "insensitive" as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
        select: { id: true, email: true, displayName: true, role: true, status: true, createdAt: true, creatorProfile: { select: { slug: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  });

  app.post("/admin/users/:id/suspend", async (request) => {
    const session = app.requireRole(request, "ADMIN");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ reason: z.string().min(1).max(500) }).parse(request.body);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new NotFoundError("User not found");

    await applyModerationAction(prisma, { moderatorUserId: session.userId, targetType: "USER", targetId: id, action: "SUSPEND_CREATOR", reason: body.reason });
    return prisma.user.findUniqueOrThrow({ where: { id } });
  });

  app.post("/admin/users/:id/reactivate", async (request) => {
    const session = app.requireRole(request, "ADMIN");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new NotFoundError("User not found");

    await applyModerationAction(prisma, { moderatorUserId: session.userId, targetType: "USER", targetId: id, action: "REACTIVATE_USER" });
    return prisma.user.findUniqueOrThrow({ where: { id } });
  });

  // ── Stories / chapters (cross-creator; any status, not just PUBLISHED) ─
  app.get("/admin/stories", async (request) => {
    app.requireRole(request, "MODERATOR");
    const query = paginationSchema
      .extend({
        status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "UNPUBLISHED", "REJECTED", "ARCHIVED"]).optional(),
        creatorId: z.string().uuid().optional(),
        q: z.string().optional(),
      })
      .parse(request.query);

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.creatorId ? { creatorId: query.creatorId } : {}),
      ...(query.q ? { title: { contains: query.q, mode: "insensitive" as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: query.limit,
        skip: query.offset,
        include: { creator: { select: { slug: true, displayName: true } }, seoMetadata: { select: { noindex: true } } },
      }),
      prisma.content.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  });

  app.get("/admin/stories/:id/chapters", async (request) => {
    app.requireRole(request, "MODERATOR");
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const chapters = await prisma.contentPart.findMany({ where: { contentId: id }, orderBy: { position: "asc" } });
    return { chapters };
  });

  const contentModerationAction = (action: "PUBLISH" | "UNPUBLISH" | "DELETE" | "RESTORE" | "NOINDEX") => async (request: FastifyRequest) => {
    const session = app.requireRole(request, "MODERATOR");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ reason: z.string().max(500).optional() }).parse(request.body ?? {});

    const content = await prisma.content.findUnique({ where: { id } });
    if (!content) throw new NotFoundError("Story not found");

    await applyModerationAction(prisma, { moderatorUserId: session.userId, targetType: "CONTENT", targetId: id, action, reason: body.reason });
    return prisma.content.findUniqueOrThrow({ where: { id }, include: { seoMetadata: true } });
  };

  app.post("/admin/stories/:id/publish", contentModerationAction("PUBLISH"));
  app.post("/admin/stories/:id/unpublish", contentModerationAction("UNPUBLISH"));
  app.post("/admin/stories/:id/delete", contentModerationAction("DELETE"));
  app.post("/admin/stories/:id/restore", contentModerationAction("RESTORE"));
  app.post("/admin/stories/:id/noindex", contentModerationAction("NOINDEX"));

  // ── Reports ─────────────────────────────────────────────────────────
  app.get("/admin/reports", async (request) => {
    app.requireRole(request, "MODERATOR");
    const query = paginationSchema.extend({ status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "REJECTED"]).optional() }).parse(request.query);

    const where = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      prisma.moderationReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
        include: { reporter: { select: { email: true, displayName: true } }, actions: true },
      }),
      prisma.moderationReport.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  });

  app.post("/admin/reports/:id/review", async (request) => {
    app.requireRole(request, "MODERATOR");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      return await transitionReportStatus(prisma, id, "REVIEWING");
    } catch (err) {
      if (err instanceof InvalidReportTransitionError) throw new ConflictError(err.message);
      throw err;
    }
  });

  app.post("/admin/reports/:id/reject", async (request) => {
    app.requireRole(request, "MODERATOR");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      return await transitionReportStatus(prisma, id, "REJECTED");
    } catch (err) {
      if (err instanceof InvalidReportTransitionError) throw new ConflictError(err.message);
      throw err;
    }
  });

  const reportActionSchema = z.object({
    targetType: z.enum(["CONTENT", "CONTENT_PART", "USER", "COMMENT"]),
    targetId: z.string().uuid(),
    action: z.enum(["PUBLISH", "UNPUBLISH", "DELETE", "RESTORE", "NOINDEX", "SUSPEND_CREATOR", "REACTIVATE_USER"]),
    reason: z.string().max(500).optional(),
  });

  app.post("/admin/reports/:id/action", async (request) => {
    const session = app.requireRole(request, "MODERATOR");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = reportActionSchema.parse(request.body);

    if ((body.action === "SUSPEND_CREATOR" || body.action === "REACTIVATE_USER") && session.role !== "ADMIN") {
      throw new ValidationError("Only ADMIN can suspend or reactivate a user account");
    }

    const report = await prisma.moderationReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundError("Report not found");

    return applyModerationAction(prisma, {
      moderatorUserId: session.userId,
      targetType: body.targetType,
      targetId: body.targetId,
      action: body.action,
      reason: body.reason,
      reportId: id,
    });
  });

  // Lets a MODERATOR/ADMIN file a report on behalf of a user (e.g. from a support ticket), for parity with the public report-a-content flow.
  app.post("/admin/reports", async (request) => {
    const session = app.requireRole(request, "MODERATOR");
    app.requireCsrf(request);
    const body = z
      .object({ targetType: z.enum(["CONTENT", "CONTENT_PART", "USER", "COMMENT"]), targetId: z.string().uuid(), reason: z.string().min(1).max(500), details: z.string().max(2000).optional() })
      .parse(request.body);

    const report = await createModerationReport(prisma, { reporterUserId: session.userId, ...body });
    return report;
  });

  // ── Revenue configuration (versioned, never hard-coded — spec #72) ────
  app.get("/admin/revenue-configs", async (request) => {
    app.requireRole(request, "MODERATOR");
    const configs = await prisma.revenueConfig.findMany({ orderBy: { version: "desc" } });
    return { items: configs };
  });

  const revenueConfigSchema = z.object({
    creatorPoolPercentage: z.number().min(0).max(100),
    platformPercentage: z.number().min(0).max(100),
    fraudReservePercentage: z.number().min(0).max(100),
    minimumPayoutThresholdCents: z.coerce.bigint().positive(),
    currency: z.string().min(3).max(3).default("VND"),
    effectiveFrom: z.string().datetime(),
  });

  app.post("/admin/revenue-configs", async (request) => {
    const session = app.requireRole(request, "ADMIN");
    app.requireCsrf(request);
    const body = revenueConfigSchema.parse(request.body);

    const total = body.creatorPoolPercentage + body.platformPercentage + body.fraudReservePercentage;
    if (Math.abs(total - 100) > 0.01) {
      throw new ValidationError(`creatorPoolPercentage + platformPercentage + fraudReservePercentage must sum to 100 (got ${total})`);
    }

    const latest = await prisma.revenueConfig.aggregate({ _max: { version: true } });
    const nextVersion = (latest._max.version ?? 0) + 1;

    return prisma.revenueConfig.create({
      data: {
        version: nextVersion,
        creatorPoolPercentage: body.creatorPoolPercentage,
        platformPercentage: body.platformPercentage,
        fraudReservePercentage: body.fraudReservePercentage,
        minimumPayoutThresholdCents: body.minimumPayoutThresholdCents,
        currency: body.currency,
        effectiveFrom: new Date(body.effectiveFrom),
        createdById: session.userId,
      },
    });
  });

  // ── Wallet adjustment (spec #40 "Adjust revenue" — always ledgered) ───
  app.post("/admin/creators/:id/wallet/adjust", async (request) => {
    const session = app.requireRole(request, "ADMIN");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ amountCents: z.coerce.bigint(), description: z.string().min(1).max(500), currency: z.string().min(3).max(3).default("VND") }).parse(request.body);

    const creator = await prisma.creatorProfile.findUnique({ where: { id } });
    if (!creator || creator.deletedAt) throw new NotFoundError("Creator not found");
    if (body.amountCents === 0n) throw new ValidationError("amountCents must be non-zero");

    const entry = await ledger.appendEntry({
      creatorId: id,
      type: "ADJUSTMENT",
      amountCents: body.amountCents,
      currency: body.currency,
      description: `[Admin adjustment by ${session.userId}] ${body.description}`,
    });

    return entry;
  });

  // ── Payouts ─────────────────────────────────────────────────────────
  app.get("/admin/payouts", async (request) => {
    app.requireRole(request, "MODERATOR");
    const query = paginationSchema.extend({ status: z.enum(["PENDING", "PROCESSING", "PAID", "FAILED", "REVERSED"]).optional() }).parse(request.query);

    const where = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: query.limit,
        skip: query.offset,
        include: { creator: { select: { slug: true, displayName: true } }, payoutAccount: { select: { provider: true } } },
      }),
      prisma.payout.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  });

  const payoutStatusSchema = z.object({
    status: z.enum(["PROCESSING", "PAID", "FAILED", "REVERSED"]),
    failureReason: z.string().max(500).optional(),
  });

  app.post("/admin/payouts/:id/status", async (request) => {
    const session = app.requireRole(request, "ADMIN");
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = payoutStatusSchema.parse(request.body);

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundError("Payout not found");

    if (body.status === "PAID") {
      if (payout.status !== "PENDING" && payout.status !== "PROCESSING") {
        throw new ConflictError(`Cannot mark a ${payout.status} payout as PAID`);
      }
      const wallet = await prisma.wallet.findUnique({ where: { creatorId: payout.creatorId } });
      if (!wallet || wallet.balanceAvailableCents < payout.amountCents) {
        throw new ConflictError("Creator's available balance is insufficient for this payout");
      }
      await ledger.appendEntry({
        creatorId: payout.creatorId,
        type: "PAYOUT",
        amountCents: -payout.amountCents,
        currency: payout.currency,
        relatedPayoutId: payout.id,
        description: `Payout ${payout.id} marked PAID by admin ${session.userId}`,
      });
      return prisma.payout.update({ where: { id }, data: { status: "PAID", processedAt: new Date() } });
    }

    if (body.status === "REVERSED") {
      if (payout.status !== "PAID") throw new ConflictError("Only a PAID payout can be reversed");
      await ledger.appendEntry({
        creatorId: payout.creatorId,
        type: "ADJUSTMENT",
        amountCents: payout.amountCents,
        currency: payout.currency,
        relatedPayoutId: payout.id,
        description: `Reversal of payout ${payout.id} by admin ${session.userId}`,
      });
      return prisma.payout.update({ where: { id }, data: { status: "REVERSED", processedAt: new Date() } });
    }

    if (body.status === "FAILED") {
      return prisma.payout.update({ where: { id }, data: { status: "FAILED", failureReason: body.failureReason, processedAt: new Date() } });
    }

    return prisma.payout.update({ where: { id }, data: { status: "PROCESSING" } });
  });

  // ── SEO health (spec #75) ───────────────────────────────────────────
  app.get("/admin/seo-health", async (request) => {
    app.requireRole(request, "MODERATOR");

    const publicWhere = { type: "STORY" as const, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };

    const [totalPublic, missingDescription, missingCover, noindexed, duplicateSlugGroups, publishedWithoutChapters] = await Promise.all([
      prisma.content.count({ where: publicWhere }),
      prisma.content.count({ where: { ...publicWhere, OR: [{ description: null }, { description: "" }] } }),
      prisma.content.count({ where: { ...publicWhere, coverImage: null } }),
      prisma.content.count({ where: { ...publicWhere, seoMetadata: { noindex: true } } }),
      prisma.content.groupBy({ by: ["slug"], _count: { slug: true }, having: { slug: { _count: { gt: 1 } } } }),
      prisma.content.count({ where: { ...publicWhere, parts: { none: { status: "PUBLISHED" } } } }),
    ]);

    return {
      totalPublic,
      missingDescription,
      missingCover,
      noindexed,
      duplicateSlugs: duplicateSlugGroups.length,
      publishedWithoutChapters,
    };
  });
}
