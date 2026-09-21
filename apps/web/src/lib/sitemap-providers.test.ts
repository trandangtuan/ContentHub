import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility, ContentPartStatus } from "@contenthub/database";
import { StorySitemapProvider, ChapterSitemapProvider, TagSitemapProvider } from "./sitemap-providers";

let publicSlug: string;
let draftSlug: string;
let thinTagSlug: string;
let indexableTagSlug: string;

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

  it("every entry has both loc and lastmod", async () => {
    const { entries } = await new StorySitemapProvider().getUrls("1");
    for (const entry of entries) {
      expect(entry.loc).toMatch(/^https:\/\/example\.com\/truyen\//);
      expect(entry.lastmod).toBeTruthy();
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
});
