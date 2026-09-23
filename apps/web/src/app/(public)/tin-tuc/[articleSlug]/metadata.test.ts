import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { generateMetadata } from "./page";

let publicSlug: string;
let draftSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `article-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Meta Test", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `article-meta-${suffix}`, displayName: "Meta Test Creator" } });

  const published = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.ARTICLE,
      title: "Metadata Test Article",
      slug: `article-metadata-test-${suffix}`,
      description: "Mô tả tin tức kiểm thử metadata.",
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      article: { create: { bodyHtml: "<p>noi dung</p>", wordCount: 2 } },
    },
  });
  publicSlug = published.slug;

  const draft = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.ARTICLE,
      title: "Metadata Test Draft Article",
      slug: `article-metadata-test-draft-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
      article: { create: { bodyHtml: "<p>draft</p>", wordCount: 1 } },
    },
  });
  draftSlug = draft.slug;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Article page generateMetadata", () => {
  it("indexes a published public article with full SEO metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ articleSlug: publicSlug }) });
    expect(meta.title).toBe("Metadata Test Article – ContentHub");
    expect(meta.description).toContain("kiểm thử");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect((meta.alternates as { canonical: string }).canonical).toBe(`https://example.com/tin-tuc/${publicSlug}`);
  });

  it("noindexes a draft article", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ articleSlug: draftSlug }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("noindexes a nonexistent slug rather than throwing", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ articleSlug: "does-not-exist-xyz" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
