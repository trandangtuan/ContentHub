import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility, ContentPartStatus } from "@contenthub/database";
import { generateMetadata } from "./page";

let storySlug: string;
let articleSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `part-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Part Meta Test", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `part-meta-${suffix}`, displayName: "Part Meta Test Creator" } });

  const story = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Part Metadata Test Story",
      slug: `part-metadata-test-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      parts: { create: { title: "Chương 1", slug: "chuong-1", position: 1, bodyHtml: "<p>" + "word ".repeat(50) + "</p>", wordCount: 50, status: ContentPartStatus.PUBLISHED, publishedAt: new Date() } },
    },
  });
  storySlug = story.slug;

  const article = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.ARTICLE,
      title: "Part Metadata Test Article",
      slug: `part-metadata-test-article-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      parts: { create: { title: "Part Metadata Test Article", slug: "content", position: 1, bodyHtml: "<p>noi dung</p>", wordCount: 2, status: ContentPartStatus.PUBLISHED } },
    },
  });
  articleSlug = article.slug;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Part (chapter) page generateMetadata", () => {
  it("indexes a published chapter of a multi-part type (STORY)", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "truyen", itemSlug: storySlug, partSlug: "chuong-1" }) });
    expect(meta.title).toBe("Chương 1 – Part Metadata Test Story – ContentHub");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect((meta.alternates as { canonical: string }).canonical).toBe(`https://example.com/truyen/${storySlug}/chuong-1`);
  });

  it("noindexes a nonexistent chapter slug rather than throwing", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "truyen", itemSlug: storySlug, partSlug: "does-not-exist" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("noindexes any part route for a single partsMode type (ARTICLE) — it has no addressable parts", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "tin-tuc", itemSlug: articleSlug, partSlug: "content" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
