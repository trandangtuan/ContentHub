import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility, ContentPartStatus } from "@contenthub/database";
import { StorySitemapProvider, ChapterSitemapProvider, CategorySitemapProvider, TagSitemapProvider, ArticleSitemapProvider } from "./sitemap-providers";

let publicSlug: string;
let draftSlug: string;
let deletedSlug: string;
let publicArticleSlug: string;
let draftArticleSlug: string;
let thinTagSlug: string;
let indexableTagSlug: string;
let thinCategorySlug: string;
let indexableCategorySlug: string;
let draftOnlyTagSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `sitemap-test-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Sitemap Test", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `sitemap-test-${suffix}`, displayName: "Sitemap Test Creator" } });

  const thinTag = await prisma.tag.create({ data: { slug: `thin-tag-${suffix}`, name: "Thin Tag" } });
  const indexableTag = await prisma.tag.create({ data: { slug: `indexable-tag-${suffix}`, name: "Indexable Tag" } });
  thinTagSlug = thinTag.slug;
  indexableTagSlug = indexableTag.slug;

  const published = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Sitemap Public Story",
      slug: `sitemap-public-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      tags: { create: [{ tagId: thinTag.id }] },
    },
  });
  publicSlug = published.slug;

  await prisma.contentPart.create({ data: { contentId: published.id, title: "C1", slug: "c1", position: 1, status: ContentPartStatus.PUBLISHED, publishedAt: new Date() } });
  await prisma.contentPart.create({ data: { contentId: published.id, title: "C2 draft", slug: "c2", position: 2, status: ContentPartStatus.DRAFT } });

  const second = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Sitemap Second Public Story",
      slug: `sitemap-public-2-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      tags: { create: [{ tagId: indexableTag.id }] },
    },
  });

  const third = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Sitemap Third Public Story",
      slug: `sitemap-public-3-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      tags: { create: [{ tagId: indexableTag.id }] },
    },
  });
  void second;
  void third;

  const draft = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Sitemap Draft Story",
      slug: `sitemap-draft-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
    },
  });
  draftSlug = draft.slug;

  const deleted = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Sitemap Deleted Story",
      slug: `sitemap-deleted-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      deletedAt: new Date(),
    },
  });
  deletedSlug = deleted.slug;

  const publicArticle = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.ARTICLE,
      title: "Sitemap Public Article",
      slug: `sitemap-public-article-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      article: { create: { bodyHtml: "<p>news</p>", wordCount: 1 } },
    },
  });
  publicArticleSlug = publicArticle.slug;

  const draftArticle = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.ARTICLE,
      title: "Sitemap Draft Article",
      slug: `sitemap-draft-article-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
      article: { create: { bodyHtml: "<p>draft</p>", wordCount: 1 } },
    },
  });
  draftArticleSlug = draftArticle.slug;

  const thinCategory = await prisma.category.create({ data: { slug: `thin-category-sitemap-${suffix}`, name: "Thin Category Sitemap" } });
  thinCategorySlug = thinCategory.slug;
  const indexableCategory = await prisma.category.create({ data: { slug: `indexable-category-sitemap-${suffix}`, name: "Indexable Category Sitemap" } });
  indexableCategorySlug = indexableCategory.slug;
  await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Category Sitemap Story A",
      slug: `category-sitemap-a-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      categories: { create: [{ categoryId: thinCategory.id }, { categoryId: indexableCategory.id }] },
    },
  });
  await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Category Sitemap Story B",
      slug: `category-sitemap-b-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
      categories: { create: [{ categoryId: indexableCategory.id }] },
    },
  });

  // A tag attached to 2 stories, but both DRAFT — an unfiltered _count would
  // wrongly mark this indexable at 2; the fix filters _count to public content.
  const draftOnlyTag = await prisma.tag.create({ data: { slug: `draft-only-tag-${suffix}`, name: "Draft Only Tag" } });
  draftOnlyTagSlug = draftOnlyTag.slug;
  for (let i = 0; i < 2; i++) {
    await prisma.content.create({
      data: {
        creatorId: creator.id,
        type: ContentType.STORY,
        title: `Draft Only Tag Story ${i}`,
        slug: `draft-only-tag-story-${i}-${suffix}`,
        status: ContentStatus.DRAFT,
        visibility: ContentVisibility.PRIVATE,
        tags: { create: [{ tagId: draftOnlyTag.id }] },
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("StorySitemapProvider", () => {
  it("includes published public stories and excludes drafts", async () => {
    const { entries } = await new StorySitemapProvider().getUrls("1");
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(publicSlug))).toBe(true);
    expect(locs.some((l) => l.includes(draftSlug))).toBe(false);
  });

  it("excludes a soft-deleted story even though it's PUBLISHED+PUBLIC", async () => {
    const { entries } = await new StorySitemapProvider().getUrls("1");
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(deletedSlug))).toBe(false);
  });

  it("every entry has both loc and lastmod", async () => {
    const { entries } = await new StorySitemapProvider().getUrls("1");
    for (const entry of entries) {
      expect(entry.loc).toMatch(/^https:\/\/example\.com\/truyen\//);
      expect(entry.lastmod).toBeTruthy();
    }
  });
});

describe("ArticleSitemapProvider", () => {
  it("includes published public articles and excludes drafts", async () => {
    const { entries } = await new ArticleSitemapProvider().getUrls("1");
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(publicArticleSlug))).toBe(true);
    expect(locs.some((l) => l.includes(draftArticleSlug))).toBe(false);
  });

  it("every entry points at /tin-tuc/", async () => {
    const { entries } = await new ArticleSitemapProvider().getUrls("1");
    for (const entry of entries) {
      expect(entry.loc).toMatch(/^https:\/\/example\.com\/tin-tuc\//);
    }
  });
});

describe("ChapterSitemapProvider", () => {
  it("includes only published chapters of published public stories", async () => {
    const { entries } = await new ChapterSitemapProvider().getUrls("1");
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l === `https://example.com/truyen/${publicSlug}/c1`)).toBe(true);
    expect(locs.some((l) => l.includes("/c2"))).toBe(false);
  });
});

describe("TagSitemapProvider", () => {
  it("excludes a tag with fewer than 2 public stories (thin taxonomy)", async () => {
    const { entries } = await new TagSitemapProvider().getUrls();
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(thinTagSlug))).toBe(false);
  });

  it("includes a tag with 2+ public stories", async () => {
    const { entries } = await new TagSitemapProvider().getUrls();
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(indexableTagSlug))).toBe(true);
  });

  it("excludes a tag whose 2 stories are both drafts (unfiltered _count would wrongly include it)", async () => {
    const { entries } = await new TagSitemapProvider().getUrls();
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(draftOnlyTagSlug))).toBe(false);
  });
});

describe("CategorySitemapProvider", () => {
  it("excludes a category with fewer than 2 public stories (thin taxonomy)", async () => {
    const { entries } = await new CategorySitemapProvider().getUrls();
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(thinCategorySlug))).toBe(false);
  });

  it("includes a category with 2+ public stories", async () => {
    const { entries } = await new CategorySitemapProvider().getUrls();
    const locs = entries.map((e) => e.loc);
    expect(locs.some((l) => l.includes(indexableCategorySlug))).toBe(true);
  });
});
