import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { generateMetadata } from "./page";

let thinCategorySlug: string;
let indexableCategorySlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `category-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Category Meta", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `category-meta-${suffix}`, displayName: "Category Meta Creator" } });

  const thin = await prisma.category.create({ data: { slug: `thin-category-${suffix}`, name: "Thin Category" } });
  thinCategorySlug = thin.slug;
  // Two DRAFT stories: an unfiltered _count would see 2 and wrongly index this
  // page — the fix filters _count to PUBLISHED+PUBLIC content only.
  await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Thin Category Draft 1",
      slug: `thin-category-draft-1-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
      categories: { create: [{ categoryId: thin.id }] },
    },
  });
  await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Thin Category Draft 2",
      slug: `thin-category-draft-2-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
      categories: { create: [{ categoryId: thin.id }] },
    },
  });

  const indexable = await prisma.category.create({ data: { slug: `indexable-category-${suffix}`, name: "Indexable Category" } });
  indexableCategorySlug = indexable.slug;
  for (let i = 0; i < 2; i++) {
    await prisma.content.create({
      data: {
        creatorId: creator.id,
        type: ContentType.STORY,
        title: `Indexable Category Story ${i}`,
        slug: `indexable-category-story-${i}-${suffix}`,
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        publishedAt: new Date(),
        categories: { create: [{ categoryId: indexable.id }] },
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Category page generateMetadata", () => {
  it("noindexes a category whose only content is draft-only, even though the raw relation count is 2 (thin taxonomy)", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ categorySlug: thinCategorySlug }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("indexes a category with 2+ public stories", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ categorySlug: indexableCategorySlug }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("noindexes a nonexistent category slug rather than throwing", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ categorySlug: "does-not-exist-xyz" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
