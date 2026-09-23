import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { generateMetadata } from "./page";

let publicStorySlug: string;
let draftStorySlug: string;
let publicArticleSlug: string;
let draftArticleSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `content-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Meta Test", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `content-meta-${suffix}`, displayName: "Meta Test Creator" } });

  const publicStory = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Metadata Test Story",
      slug: `metadata-test-story-${suffix}`,
      description: "Mô tả truyện kiểm thử metadata.",
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
    },
  });
  publicStorySlug = publicStory.slug;

  const draftStory = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Metadata Test Draft Story",
      slug: `metadata-test-story-draft-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
    },
  });
  draftStorySlug = draftStory.slug;

  const publicArticle = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.ARTICLE,
      title: "Metadata Test Article",
      slug: `metadata-test-article-${suffix}`,
      description: "Mô tả tin tức kiểm thử metadata.",
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      parts: { create: { title: "Metadata Test Article", slug: "content", position: 1, bodyHtml: "<p>noi dung</p>", wordCount: 2, status: "PUBLISHED" } },
    },
  });
  publicArticleSlug = publicArticle.slug;

  const draftArticle = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.ARTICLE,
      title: "Metadata Test Draft Article",
      slug: `metadata-test-article-draft-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
      parts: { create: { title: "Metadata Test Draft Article", slug: "content", position: 1, bodyHtml: "<p>draft</p>", wordCount: 1 } },
    },
  });
  draftArticleSlug = draftArticle.slug;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Content detail page generateMetadata", () => {
  it("indexes a published public story with full SEO metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "truyen", itemSlug: publicStorySlug }) });
    expect(meta.title).toBe("Metadata Test Story – ContentHub");
    expect(meta.description).toContain("kiểm thử");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect((meta.alternates as { canonical: string }).canonical).toBe(`https://example.com/truyen/${publicStorySlug}`);
  });

  it("noindexes a draft story", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "truyen", itemSlug: draftStorySlug }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("indexes a published public article with full SEO metadata, using the same generic page", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "tin-tuc", itemSlug: publicArticleSlug }) });
    expect(meta.title).toBe("Metadata Test Article – ContentHub");
    expect(meta.description).toContain("kiểm thử");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect((meta.alternates as { canonical: string }).canonical).toBe(`https://example.com/tin-tuc/${publicArticleSlug}`);
  });

  it("noindexes a draft article", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "tin-tuc", itemSlug: draftArticleSlug }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("noindexes an unknown section", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "does-not-exist", itemSlug: publicStorySlug }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("noindexes a nonexistent slug rather than throwing", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "truyen", itemSlug: "does-not-exist-xyz" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
