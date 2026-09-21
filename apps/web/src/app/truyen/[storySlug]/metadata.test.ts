import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility } from "@contenthub/database";
import { generateMetadata } from "./page";

let publicSlug: string;
let draftSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `story-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Meta Test", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `story-meta-${suffix}`, displayName: "Meta Test Creator" } });

  const published = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Metadata Test Story",
      slug: `metadata-test-${suffix}`,
      description: "Mô tả truyện kiểm thử metadata.",
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
    },
  });
  publicSlug = published.slug;

  const draft = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Metadata Test Draft",
      slug: `metadata-test-draft-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
    },
  });
  draftSlug = draft.slug;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Story page generateMetadata", () => {
  it("indexes a published public story with full SEO metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ storySlug: publicSlug }) });
    expect(meta.title).toBe("Metadata Test Story – ContentHub");
    expect(meta.description).toContain("kiểm thử");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect((meta.alternates as { canonical: string }).canonical).toBe(`https://example.com/truyen/${publicSlug}`);
  });

  it("noindexes a draft story", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ storySlug: draftSlug }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("noindexes a nonexistent slug rather than throwing", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ storySlug: "does-not-exist-xyz" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
