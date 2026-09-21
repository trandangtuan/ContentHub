import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility, ContentPartStatus } from "@contenthub/database";
import { generateMetadata } from "./page";

let storySlug: string;
let publishedChapterSlug: string;
let draftChapterSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `chapter-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Chapter Meta", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({ data: { userId: user.id, slug: `chapter-meta-${suffix}`, displayName: "Chapter Meta Creator" } });

  const story = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Chapter Metadata Story",
      slug: `chapter-metadata-${suffix}`,
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
    },
  });
  storySlug = story.slug;

  const published = await prisma.contentPart.create({
    data: { contentId: story.id, title: "Chương Một", slug: "chuong-mot", position: 1, bodyHtml: "<p>" + "Nội dung ".repeat(50) + "</p>", status: ContentPartStatus.PUBLISHED, publishedAt: new Date() },
  });
  publishedChapterSlug = published.slug;

  const draft = await prisma.contentPart.create({
    data: { contentId: story.id, title: "Chương Nháp", slug: "chuong-nhap", position: 2, status: ContentPartStatus.DRAFT },
  });
  draftChapterSlug = draft.slug;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Chapter page generateMetadata", () => {
  it("indexes a published chapter with title/story/excerpt description, never the full body", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ storySlug, chapterSlug: publishedChapterSlug }) });
    expect(meta.title).toBe("Chương Một – Chapter Metadata Story – ContentHub");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect((meta.description as string).length).toBeLessThanOrEqual(160);
  });

  it("noindexes a draft chapter of an otherwise-published story", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ storySlug, chapterSlug: draftChapterSlug }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
