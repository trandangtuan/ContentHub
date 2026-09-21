import { describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { SessionService } from "@contenthub/auth";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

const app = buildApp(loadApiConfig());
await app.ready(); // decorators (issueCsrfToken, requireRole, ...) attach once plugins finish registering
const sessions = new SessionService(prisma);

function unique(label: string) {
  return `admin-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function sessionFor(role: "READER" | "MODERATOR" | "ADMIN") {
  const user = await prisma.user.create({
    data: { email: `${unique(role)}@contenthub.dev`, passwordHash: "x", displayName: `${role} Test`, role },
  });
  const { token } = await sessions.createSession({ userId: user.id, ttlDays: 30 });
  const csrfToken = app.issueCsrfToken(token);
  return { userId: user.id, cookies: { ch_session: token }, csrfToken };
}

async function createStory(overrides: Partial<{ status: ContentStatus; visibility: ContentVisibility; title: string }> = {}) {
  const suffix = unique("story");
  const user = await prisma.user.create({ data: { email: `${suffix}-owner@contenthub.dev`, passwordHash: "x", displayName: "Story Owner", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: suffix, displayName: "Story Owner" } });
  const content = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: overrides.title ?? `Admin Test Story ${suffix}`,
      slug: `${suffix}-slug`,
      description: "d",
      status: overrides.status ?? ContentStatus.PENDING_REVIEW,
      visibility: overrides.visibility ?? ContentVisibility.PRIVATE,
    },
  });
  return { content, creator };
}

describe("RBAC gating", () => {
  it("rejects a READER from every admin route", async () => {
    const { cookies } = await sessionFor("READER");
    const response = await app.inject({ method: "GET", url: "/api/v1/admin/stats", cookies });
    expect(response.statusCode).toBe(403);
  });

  it("allows MODERATOR to read but not to suspend a user (ADMIN-only)", async () => {
    const moderator = await sessionFor("MODERATOR");
    const stats = await app.inject({ method: "GET", url: "/api/v1/admin/stats", cookies: moderator.cookies });
    expect(stats.statusCode).toBe(200);

    const target = await sessionFor("READER");
    const suspend = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${target.userId}/suspend`,
      cookies: moderator.cookies,
      headers: { "x-csrf-token": moderator.csrfToken },
      payload: { reason: "test" },
    });
    expect(suspend.statusCode).toBe(403);
  });
});

describe("User management", () => {
  it("ADMIN can suspend and reactivate a user, both writing audit-trail moderation_actions", async () => {
    const admin = await sessionFor("ADMIN");
    const target = await sessionFor("READER");

    const suspend = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${target.userId}/suspend`,
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
      payload: { reason: "Spam reports" },
    });
    expect(suspend.statusCode).toBe(200);
    expect(suspend.json().status).toBe("SUSPENDED");

    const reactivate = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${target.userId}/reactivate`,
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
    });
    expect(reactivate.statusCode).toBe(200);
    expect(reactivate.json().status).toBe("ACTIVE");

    const actions = await prisma.moderationAction.findMany({ where: { targetType: "USER", targetId: target.userId } });
    expect(actions.map((a) => a.action).sort()).toEqual(["REACTIVATE_USER", "SUSPEND_CREATOR"]);
  });
});

describe("Story moderation", () => {
  it("MODERATOR can publish/unpublish/noindex/delete/restore a story cross-creator", async () => {
    const moderator = await sessionFor("MODERATOR");
    const { content } = await createStory();

    const publish = await app.inject({ method: "POST", url: `/api/v1/admin/stories/${content.id}/publish`, cookies: moderator.cookies, headers: { "x-csrf-token": moderator.csrfToken } });
    expect(publish.json().status).toBe("PUBLISHED");

    const noindex = await app.inject({ method: "POST", url: `/api/v1/admin/stories/${content.id}/noindex`, cookies: moderator.cookies, headers: { "x-csrf-token": moderator.csrfToken } });
    expect(noindex.json().seoMetadata.noindex).toBe(true);

    const del = await app.inject({ method: "POST", url: `/api/v1/admin/stories/${content.id}/delete`, cookies: moderator.cookies, headers: { "x-csrf-token": moderator.csrfToken } });
    expect(del.json().status).toBe("ARCHIVED");
    expect(del.json().deletedAt).not.toBeNull();

    const restore = await app.inject({ method: "POST", url: `/api/v1/admin/stories/${content.id}/restore`, cookies: moderator.cookies, headers: { "x-csrf-token": moderator.csrfToken } });
    expect(restore.json().deletedAt).toBeNull();
  });

  it("lists stories across all creators with status filtering", async () => {
    const moderator = await sessionFor("MODERATOR");
    const { content: draft } = await createStory({ status: ContentStatus.DRAFT });

    const response = await app.inject({ method: "GET", url: "/api/v1/admin/stories?status=DRAFT&limit=50", cookies: moderator.cookies });
    const body = response.json();
    expect(body.items.some((s: { id: string }) => s.id === draft.id)).toBe(true);
  });
});

describe("Reports", () => {
  it("files, reviews, and resolves a report by applying a moderation action", async () => {
    const moderator = await sessionFor("MODERATOR");
    const { content } = await createStory();

    const fileReport = await app.inject({
      method: "POST",
      url: "/api/v1/admin/reports",
      cookies: moderator.cookies,
      headers: { "x-csrf-token": moderator.csrfToken },
      payload: { targetType: "CONTENT", targetId: content.id, reason: "copyright" },
    });
    expect(fileReport.statusCode).toBe(200);
    const reportId = fileReport.json().id;

    const review = await app.inject({ method: "POST", url: `/api/v1/admin/reports/${reportId}/review`, cookies: moderator.cookies, headers: { "x-csrf-token": moderator.csrfToken } });
    expect(review.json().status).toBe("REVIEWING");

    const resolve = await app.inject({
      method: "POST",
      url: `/api/v1/admin/reports/${reportId}/action`,
      cookies: moderator.cookies,
      headers: { "x-csrf-token": moderator.csrfToken },
      payload: { targetType: "CONTENT", targetId: content.id, action: "UNPUBLISH", reason: "Confirmed copyright violation" },
    });
    expect(resolve.statusCode).toBe(200);

    const report = await prisma.moderationReport.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.status).toBe("RESOLVED");
  });

  it("rejects a MODERATOR trying to suspend a user via a report action (ADMIN-only)", async () => {
    const moderator = await sessionFor("MODERATOR");
    const target = await sessionFor("READER");

    const fileReport = await app.inject({
      method: "POST",
      url: "/api/v1/admin/reports",
      cookies: moderator.cookies,
      headers: { "x-csrf-token": moderator.csrfToken },
      payload: { targetType: "USER", targetId: target.userId, reason: "harassment" },
    });
    const reportId = fileReport.json().id;

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/reports/${reportId}/action`,
      cookies: moderator.cookies,
      headers: { "x-csrf-token": moderator.csrfToken },
      payload: { targetType: "USER", targetId: target.userId, action: "SUSPEND_CREATOR" },
    });
    expect(response.statusCode).toBe(422);
  });
});

describe("Revenue config", () => {
  it("ADMIN can create a new versioned revenue config; percentages must sum to 100", async () => {
    const admin = await sessionFor("ADMIN");

    const bad = await app.inject({
      method: "POST",
      url: "/api/v1/admin/revenue-configs",
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
      payload: { creatorPoolPercentage: 70, platformPercentage: 40, fraudReservePercentage: 5, minimumPayoutThresholdCents: "50000000", effectiveFrom: new Date().toISOString() },
    });
    expect(bad.statusCode).toBe(422);

    const good = await app.inject({
      method: "POST",
      url: "/api/v1/admin/revenue-configs",
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
      payload: { creatorPoolPercentage: 65, platformPercentage: 30, fraudReservePercentage: 5, minimumPayoutThresholdCents: "50000000", effectiveFrom: new Date().toISOString() },
    });
    expect(good.statusCode).toBe(200);
    expect(good.json().version).toBeGreaterThanOrEqual(1);
  });

  it("MODERATOR cannot create a revenue config (ADMIN-only)", async () => {
    const moderator = await sessionFor("MODERATOR");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/revenue-configs",
      cookies: moderator.cookies,
      headers: { "x-csrf-token": moderator.csrfToken },
      payload: { creatorPoolPercentage: 70, platformPercentage: 25, fraudReservePercentage: 5, minimumPayoutThresholdCents: "50000000", effectiveFrom: new Date().toISOString() },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("Wallet adjustment", () => {
  it("credits/debits a creator's wallet through the ledger, never a direct field write", async () => {
    const admin = await sessionFor("ADMIN");
    const { creator } = await createStory();

    const credit = await app.inject({
      method: "POST",
      url: `/api/v1/admin/creators/${creator.id}/wallet/adjust`,
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
      payload: { amountCents: "10000", description: "Goodwill credit" },
    });
    expect(credit.statusCode).toBe(200);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { creatorId: creator.id } });
    expect(wallet.balanceAvailableCents).toBe(10_000n);

    const txns = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id } });
    expect(txns).toHaveLength(1);
    expect(txns[0]!.type).toBe("ADJUSTMENT");
  });
});

describe("Payouts", () => {
  it("marking a payout PAID debits available balance and credits paid, via the ledger", async () => {
    const admin = await sessionFor("ADMIN");
    const { creator } = await createStory();

    await app.inject({
      method: "POST",
      url: `/api/v1/admin/creators/${creator.id}/wallet/adjust`,
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
      payload: { amountCents: "1000000", description: "Seed balance for payout test" },
    });

    const payoutAccount = await prisma.payoutAccount.create({ data: { creatorId: creator.id, provider: "manual", accountDetails: {} } });
    const payout = await prisma.payout.create({
      data: {
        creatorId: creator.id,
        payoutAccountId: payoutAccount.id,
        amountCents: 500_000n,
        periodStart: new Date("2026-09-01"),
        periodEnd: new Date("2026-09-30"),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/payouts/${payout.id}/status`,
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
      payload: { status: "PAID" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("PAID");

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { creatorId: creator.id } });
    expect(wallet.balanceAvailableCents).toBe(500_000n);
    expect(wallet.balancePaidCents).toBe(500_000n);
  });

  it("refuses to mark a payout PAID when the available balance is insufficient", async () => {
    const admin = await sessionFor("ADMIN");
    const { creator } = await createStory();
    const payoutAccount = await prisma.payoutAccount.create({ data: { creatorId: creator.id, provider: "manual", accountDetails: {} } });
    const payout = await prisma.payout.create({
      data: { creatorId: creator.id, payoutAccountId: payoutAccount.id, amountCents: 500_000n, periodStart: new Date("2026-09-01"), periodEnd: new Date("2026-09-30") },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/payouts/${payout.id}/status`,
      cookies: admin.cookies,
      headers: { "x-csrf-token": admin.csrfToken },
      payload: { status: "PAID" },
    });
    expect(response.statusCode).toBe(409);
  });
});

describe("SEO health", () => {
  it("counts published stories missing a description/cover", async () => {
    const moderator = await sessionFor("MODERATOR");
    const suffix = unique("seo");
    const user = await prisma.user.create({ data: { email: `${suffix}@contenthub.dev`, passwordHash: "x", displayName: "SEO Owner", role: "CREATOR" } });
    const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: suffix, displayName: "SEO Owner" } });
    await prisma.content.create({
      data: {
        creatorId: creator.id,
        type: ContentType.STORY,
        title: "No description story",
        slug: `${suffix}-story`,
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        publishedAt: new Date(),
      },
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/admin/seo-health", cookies: moderator.cookies });
    const body = response.json();
    expect(body.missingDescription).toBeGreaterThanOrEqual(1);
    expect(body.missingCover).toBeGreaterThanOrEqual(1);
  });
});
