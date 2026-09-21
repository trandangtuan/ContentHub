import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { PostgresSearchProvider } from "./postgres-provider";

const prisma = new PrismaClient();
const provider = new PostgresSearchProvider(prisma);

let creatorId: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({
    data: { email: `search-test-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Search Test", role: "CREATOR" },
  });
  const creator = await prisma.creatorProfile.create({
    data: { userId: user.id, slug: `search-test-${suffix}`, displayName: "Search Test Creator" },
  });
  creatorId = creator.id;

  await prisma.content.create({
    data: {
      creatorId,
      type: ContentType.STORY,
      title: "Kiếm Thánh Vô Song",
      slug: `kiem-thanh-${suffix}`,
      shortDescription: "Truyện kiếm hiệp đỉnh cao",
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
    },
  });

  await prisma.content.create({
    data: {
      creatorId,
      type: ContentType.STORY,
      title: "Kiếm Thánh Bản Nháp",
      slug: `kiem-thanh-draft-${suffix}`,
      shortDescription: "Bản nháp chưa xuất bản",
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("PostgresSearchProvider", () => {
  it("finds published public content matching the query", async () => {
    const results = await provider.search({ text: "Kiếm Thánh" });
    expect(results.items.some((r) => r.title === "Kiếm Thánh Vô Song")).toBe(true);
  });

  it("excludes draft/private content from results", async () => {
    const results = await provider.search({ text: "Kiếm Thánh" });
    expect(results.items.some((r) => r.title === "Kiếm Thánh Bản Nháp")).toBe(false);
  });

  it("returns empty results for blank queries instead of matching everything", async () => {
    const results = await provider.search({ text: "   " });
    expect(results.items).toEqual([]);
    expect(results.total).toBe(0);
  });
});
