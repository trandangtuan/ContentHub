import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, ContentType, ContentStatus, ContentVisibility, ContentPartStatus } from "@contenthub/database";
import { aggregateViewEventsBatch } from "./aggregate";

const prisma = new PrismaClient();
let contentId: string;
let partId: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({
    data: { email: `agg-test-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Agg Test", role: "CREATOR" },
  });
  const creator = await prisma.creatorProfile.create({
    data: { userId: user.id, slug: `agg-test-${suffix}`, displayName: "Agg Test Creator" },
  });
  const content = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Aggregate Test Story",
      slug: `agg-test-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
    },
  });
  contentId = content.id;
  const part = await prisma.contentPart.create({
    data: { contentId, title: "Chapter 1", slug: "chuong-1", position: 1, status: ContentPartStatus.PUBLISHED },
  });
  partId = part.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("aggregateViewEventsBatch", () => {
  it("upserts a ContentView row with correctly staged counts", async () => {
    const now = new Date().toISOString();
    await aggregateViewEventsBatch(prisma, [
      { contentId, contentPartId: partId, sessionIdHash: "s1", eventType: "CONTENT_VIEW", occurredAt: now, durationSec: 30, scrollDepth: 0.5 },
      { contentId, contentPartId: partId, sessionIdHash: "s2", eventType: "CONTENT_VIEW", occurredAt: now, durationSec: 1 },
    ]);

    const row = await prisma.contentView.findFirst({ where: { contentId, contentPartId: partId } });
    expect(row?.rawViews).toBe(2);
    expect(row?.qualifiedViews).toBe(1);
    expect(row?.monetizedViews).toBe(1); // content is PUBLISHED + PUBLIC
  });

  it("accumulates counts across multiple batches on the same day instead of overwriting", async () => {
    const now = new Date().toISOString();
    await aggregateViewEventsBatch(prisma, [
      { contentId, contentPartId: partId, sessionIdHash: "s3", eventType: "CONTENT_VIEW", occurredAt: now, durationSec: 30, scrollDepth: 0.5 },
    ]);

    const row = await prisma.contentView.findFirst({ where: { contentId, contentPartId: partId } });
    expect(row?.rawViews).toBe(3);
    expect(row?.monetizedViews).toBe(2);
  });

  it("ignores events without a contentPartId rather than crashing (MVP: story views are always chapter views)", async () => {
    await expect(
      aggregateViewEventsBatch(prisma, [
        { contentId, sessionIdHash: "s4", eventType: "CONTENT_VIEW", occurredAt: new Date().toISOString(), durationSec: 30 },
      ]),
    ).resolves.not.toThrow();
  });
});
