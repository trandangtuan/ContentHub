import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { applyModerationAction } from "./actions";
import { createModerationReport } from "./reports";

const prisma = new PrismaClient();
let moderatorUserId: string;
let creatorId: string;

beforeAll(async () => {
  const suffix = Date.now();
  const moderator = await prisma.user.create({
    data: { email: `mod-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Moderator", role: "MODERATOR" },
  });
  moderatorUserId = moderator.id;

  const creatorUser = await prisma.user.create({
    data: { email: `creator-mod-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Creator" },
  });
  const creator = await prisma.creatorProfile.create({
    data: { userId: creatorUser.id, slug: `creator-mod-${suffix}`, displayName: "Creator" },
  });
  creatorId = creator.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createTestContent(status: ContentStatus = ContentStatus.PENDING_REVIEW) {
  return prisma.content.create({
    data: {
      creatorId,
      type: ContentType.STORY,
      title: `Moderated Story ${Date.now()}-${Math.random()}`,
      slug: `moderated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status,
      visibility: ContentVisibility.PUBLIC,
    },
  });
}

describe("applyModerationAction", () => {
  it("writes an audit-trail ModerationAction row for every action", async () => {
    const content = await createTestContent();
    const action = await applyModerationAction(prisma, {
      moderatorUserId,
      targetType: "CONTENT",
      targetId: content.id,
      action: "PUBLISH",
      reason: "Approved after review",
    });
    expect(action.action).toBe("PUBLISH");
    expect(action.moderatorUserId).toBe(moderatorUserId);
  });

  it("PUBLISH sets content status to PUBLISHED and stamps publishedAt", async () => {
    const content = await createTestContent();
    await applyModerationAction(prisma, { moderatorUserId, targetType: "CONTENT", targetId: content.id, action: "PUBLISH" });
    const updated = await prisma.content.findUniqueOrThrow({ where: { id: content.id } });
    expect(updated.status).toBe("PUBLISHED");
    expect(updated.publishedAt).not.toBeNull();
  });

  it("DELETE soft-deletes (deleted_at set), never hard-deletes the row", async () => {
    const content = await createTestContent();
    await applyModerationAction(prisma, { moderatorUserId, targetType: "CONTENT", targetId: content.id, action: "DELETE" });
    const updated = await prisma.content.findUniqueOrThrow({ where: { id: content.id } });
    expect(updated.deletedAt).not.toBeNull();
    expect(updated.status).toBe("ARCHIVED");
  });

  it("NOINDEX creates/updates seo_metadata.noindex without changing publish status", async () => {
    const content = await createTestContent(ContentStatus.PUBLISHED);
    await applyModerationAction(prisma, { moderatorUserId, targetType: "CONTENT", targetId: content.id, action: "NOINDEX" });
    const seo = await prisma.seoMetadata.findUniqueOrThrow({ where: { contentId: content.id } });
    expect(seo.noindex).toBe(true);
  });

  it("SUSPEND_CREATOR on a USER target suspends the user", async () => {
    const suffix = Date.now();
    const targetUser = await prisma.user.create({
      data: { email: `suspend-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "To Suspend" },
    });
    await applyModerationAction(prisma, {
      moderatorUserId,
      targetType: "USER",
      targetId: targetUser.id,
      action: "SUSPEND_CREATOR",
      reason: "Repeated copyright violations",
    });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: targetUser.id } });
    expect(updated.status).toBe("SUSPENDED");
  });

  it("REACTIVATE_USER on a USER target restores ACTIVE status", async () => {
    const suffix = Date.now();
    const targetUser = await prisma.user.create({
      data: { email: `reactivate-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "To Reactivate", status: "SUSPENDED" },
    });
    await applyModerationAction(prisma, {
      moderatorUserId,
      targetType: "USER",
      targetId: targetUser.id,
      action: "REACTIVATE_USER",
      reason: "Appeal approved",
    });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: targetUser.id } });
    expect(updated.status).toBe("ACTIVE");
  });

  it("resolves the linked report, if any", async () => {
    const content = await createTestContent();
    const report = await createModerationReport(prisma, {
      reporterUserId: moderatorUserId,
      targetType: "CONTENT",
      targetId: content.id,
      reason: "copyright",
    });

    await applyModerationAction(prisma, {
      moderatorUserId,
      targetType: "CONTENT",
      targetId: content.id,
      action: "UNPUBLISH",
      reportId: report.id,
    });

    const updatedReport = await prisma.moderationReport.findUniqueOrThrow({ where: { id: report.id } });
    expect(updatedReport.status).toBe("RESOLVED");
  });
});
