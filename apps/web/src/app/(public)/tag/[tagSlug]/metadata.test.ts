import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { generateMetadata } from "./page";

let thinTagSlug: string;
let indexableTagSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `tag-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Tag Meta", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `tag-meta-${suffix}`, displayName: "Tag Meta Creator" } });

  const thin = await prisma.tag.create({ data: { slug: `thin-tag-meta-${suffix}`, name: "Thin Tag Meta" } });
  thinTagSlug = thin.slug;
  // Two DRAFT stories: an unfiltered _count would see 2 and wrongly index this
  // page — the fix filters _count to PUBLISHED+PUBLIC content only.
  for (let i = 0; i < 2; i++) {
    await prisma.content.create({
      data: {
        creatorId: creator.id,
        type: ContentType.STORY,
        title: `Thin Tag Draft ${i}`,
        slug: `thin-tag-draft-${i}-${suffix}`,
        status: ContentStatus.DRAFT,
        visibility: ContentVisibility.PRIVATE,
        tags: { create: [{ tagId: thin.id }] },
      },
    });
  }

  const indexable = await prisma.tag.create({ data: { slug: `indexable-tag-meta-${suffix}`, name: "Indexable Tag Meta" } });
  indexableTagSlug = indexable.slug;
  for (let i = 0; i < 2; i++) {
    await prisma.content.create({
      data: {
        creatorId: creator.id,
        type: ContentType.STORY,
        title: `Indexable Tag Story ${i}`,
        slug: `indexable-tag-story-${i}-${suffix}`,
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        publishedAt: new Date(),
        tags: { create: [{ tagId: indexable.id }] },
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Tag page generateMetadata", () => {
  it("noindexes a tag whose only content is draft-only, even though the raw relation count is 2 (thin taxonomy)", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ tagSlug: thinTagSlug }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("indexes a tag with 2+ public stories", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ tagSlug: indexableTagSlug }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("noindexes a nonexistent tag slug rather than throwing", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ tagSlug: "does-not-exist-xyz" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
