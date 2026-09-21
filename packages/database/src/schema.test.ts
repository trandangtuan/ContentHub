import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, ContentType, ContentStatus, ContentVisibility } from "@prisma/client";

const prisma = new PrismaClient();

let creatorId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `schema-test-${Date.now()}@contenthub.dev`,
      passwordHash: "test",
      displayName: "Schema Test User",
      role: "CREATOR",
    },
  });
  const creator = await prisma.creatorProfile.create({
    data: { userId: user.id, slug: `schema-test-${Date.now()}`, displayName: "Schema Test Creator" },
  });
  creatorId = creator.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("contents.slug", () => {
  it("enforces uniqueness", async () => {
    const slug = `unique-slug-${Date.now()}`;
    await prisma.content.create({
      data: {
        creatorId,
        type: ContentType.STORY,
        title: "First",
        slug,
        status: ContentStatus.DRAFT,
        visibility: ContentVisibility.PRIVATE,
      },
    });

    await expect(
      prisma.content.create({
        data: {
          creatorId,
          type: ContentType.STORY,
          title: "Second",
          slug,
          status: ContentStatus.DRAFT,
          visibility: ContentVisibility.PRIVATE,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("contents.search_vector trigger", () => {
  it("populates search_vector from title on insert", async () => {
    const slug = `search-vector-${Date.now()}`;
    const content = await prisma.content.create({
      data: {
        creatorId,
        type: ContentType.STORY,
        title: "Tu Tiên Huyền Thoại",
        slug,
        status: ContentStatus.DRAFT,
        visibility: ContentVisibility.PRIVATE,
      },
    });

    const rows = await prisma.$queryRaw<{ has_vector: boolean }[]>`
      SELECT search_vector IS NOT NULL AS has_vector FROM contents WHERE id = ${content.id}::uuid
    `;
    expect(rows[0]?.has_vector).toBe(true);

    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM contents
      WHERE id = ${content.id}::uuid AND search_vector @@ to_tsquery('simple', 'tiên')
    `;
    expect(matches.length).toBe(1);
  });
});

describe("content_parts", () => {
  it("enforces unique (content_id, slug)", async () => {
    const content = await prisma.content.create({
      data: {
        creatorId,
        type: ContentType.STORY,
        title: "Parts Test",
        slug: `parts-test-${Date.now()}`,
        status: ContentStatus.DRAFT,
        visibility: ContentVisibility.PRIVATE,
      },
    });

    await prisma.contentPart.create({
      data: { contentId: content.id, title: "Chapter 1", slug: "chuong-1", position: 1 },
    });

    await expect(
      prisma.contentPart.create({
        data: { contentId: content.id, title: "Chapter 1 dup", slug: "chuong-1", position: 2 },
      }),
    ).rejects.toThrow();
  });
});
