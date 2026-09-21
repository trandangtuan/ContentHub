import { beforeAll, describe, expect, it } from "vitest";
import { prisma, ContentType, ContentStatus, ContentVisibility, ContentPartStatus } from "@contenthub/database";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

const app = buildApp(loadApiConfig());

let publicStorySlug: string;
let draftStorySlug: string;
let creatorSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({
    data: { email: `public-test-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Public Test", role: "CREATOR" },
  });
  const creator = await prisma.creatorProfile.create({
    data: { userId: user.id, slug: `public-test-${suffix}`, displayName: "Public Test Creator" },
  });
  creatorSlug = creator.slug;

  const published = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Public Story",
      slug: `public-story-${suffix}`,
      description: "A public story",
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      publishedAt: new Date(),
    },
  });
  publicStorySlug = published.slug;

  await prisma.contentPart.create({
    data: { contentId: published.id, title: "Chương 1", slug: "chuong-1", position: 1, bodyHtml: "<p>Hello</p>", status: ContentPartStatus.PUBLISHED, publishedAt: new Date() },
  });

  const draft = await prisma.content.create({
    data: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Draft Story",
      slug: `draft-story-${suffix}`,
      status: ContentStatus.DRAFT,
      visibility: ContentVisibility.PRIVATE,
    },
  });
  draftStorySlug = draft.slug;
});

describe("GET /api/v1/public/stories/:slug", () => {
  it("returns a published public story with no sensitive fields", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/public/stories/${publicStorySlug}` });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.title).toBe("Public Story");
    expect(body.author.slug).toBe(creatorSlug);
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("wallet");
    expect(body).not.toHaveProperty("revenue");
  });

  it("returns 404 for a draft/private story — never leaks unpublished content", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/public/stories/${draftStorySlug}` });
    expect(response.statusCode).toBe(404);
  });

  it("returns 404 for a nonexistent slug", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/public/stories/does-not-exist" });
    expect(response.statusCode).toBe(404);
  });
});

describe("GET /api/v1/public/stories/:storySlug/chapters/:chapterSlug", () => {
  it("returns chapter content with story/author context", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/public/stories/${publicStorySlug}/chapters/chuong-1` });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.bodyHtml).toContain("Hello");
    expect(body.story.slug).toBe(publicStorySlug);
    expect(body.author.slug).toBe(creatorSlug);
  });

  it("returns 404 for a chapter of an unpublished story", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/public/stories/${draftStorySlug}/chapters/anything` });
    expect(response.statusCode).toBe(404);
  });
});

describe("GET /api/v1/public/authors/:slug", () => {
  it("lists only the creator's published stories", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/public/authors/${creatorSlug}` });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const slugs = body.stories.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain(publicStorySlug);
    expect(slugs).not.toContain(draftStorySlug);
  });
});

describe("GET /api/v1/public/stories", () => {
  it("only lists published public stories", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/public/stories?limit=50" });
    const body = response.json();
    const slugs = body.items.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain(publicStorySlug);
    expect(slugs).not.toContain(draftStorySlug);
  });
});

describe("GET /api/v1/public/search", () => {
  it("finds the published story by title", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/public/search?q=Public%20Story" });
    const body = response.json();
    expect(body.items.some((item: { slug: string }) => item.slug === publicStorySlug)).toBe(true);
  });
});
