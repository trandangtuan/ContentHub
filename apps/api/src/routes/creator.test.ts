import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@contenthub/database";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

const app = buildApp(loadApiConfig());

const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function uniqueEmail(label: string) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `creator-test-${safeLabel}-${Date.now()}-${Math.random().toString(36).slice(2)}@contenthub.dev`;
}

async function registerAndBecomeCreator(displayName: string) {
  const email = uniqueEmail(displayName);
  const register = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName } });
  const cookie = register.cookies.find((c) => c.name === "ch_session")!;
  const cookies = { [cookie.name]: cookie.value };

  const session = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies });
  const csrfToken = session.json().csrfToken as string;

  const profile = await app.inject({
    method: "POST",
    url: "/api/v1/creator/profile",
    cookies,
    headers: { "x-csrf-token": csrfToken },
    payload: { displayName },
  });

  return { cookies, csrfToken, creatorId: profile.json().id as string };
}

describe("POST /api/v1/creator/profile", () => {
  it("requires authentication", async () => {
    const response = await app.inject({ method: "POST", url: "/api/v1/creator/profile", payload: { displayName: "X" } });
    expect(response.statusCode).toBe(401);
  });

  it("requires a valid CSRF token even when authenticated", async () => {
    const email = uniqueEmail("csrf");
    const register = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName: "CSRF Test" } });
    const cookie = register.cookies.find((c) => c.name === "ch_session")!;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/creator/profile",
      cookies: { [cookie.name]: cookie.value },
      payload: { displayName: "CSRF Test" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("creates a profile, provisions a wallet, and promotes the user to CREATOR role", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Profile Creator");
    const session = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies });
    expect(session.json().role).toBe("CREATOR");
    void csrfToken;
  });
});

describe("Story + chapter lifecycle", () => {
  it("lets a creator draft a story, publish it, add a chapter, and publish the chapter", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Story Author");

    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Test Story Lifecycle ${runSuffix}`, description: "A story about testing." },
    });
    expect(createStory.statusCode).toBe(201);
    const story = createStory.json();
    expect(story.status).toBe("DRAFT");
    expect(story.slug).toBe(`test-story-lifecycle-${runSuffix}`);

    const publish = await app.inject({
      method: "POST",
      url: `/api/v1/creator/stories/${story.id}/publish`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().status).toBe("PUBLISHED");

    const addChapter = await app.inject({
      method: "POST",
      url: `/api/v1/creator/stories/${story.id}/chapters`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: "Chương 1", bodyHtml: "<p>" + "word ".repeat(250) + "</p>" },
    });
    expect(addChapter.statusCode).toBe(201);
    const chapter = addChapter.json();
    expect(chapter.wordCount).toBe(250);
    expect(chapter.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    expect(chapter.status).toBe("DRAFT");

    // The chapter isn't publicly visible until explicitly published.
    const beforePublish = await app.inject({ method: "GET", url: `/api/v1/public/stories/${story.slug}/chapters/${chapter.slug}` });
    expect(beforePublish.statusCode).toBe(404);

    const publishChapter = await app.inject({
      method: "POST",
      url: `/api/v1/creator/chapters/${chapter.id}/publish`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
    });
    expect(publishChapter.statusCode).toBe(200);
    expect(publishChapter.json().status).toBe("PUBLISHED");

    const afterPublish = await app.inject({ method: "GET", url: `/api/v1/public/stories/${story.slug}/chapters/${chapter.slug}` });
    expect(afterPublish.statusCode).toBe(200);
  });

  it("rejects publishing a story with no description", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Incomplete Author");

    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: "Incomplete Story" },
    });
    const story = createStory.json();

    const publish = await app.inject({
      method: "POST",
      url: `/api/v1/creator/stories/${story.id}/publish`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
    });
    expect(publish.statusCode).toBe(422);
  });

  it("creates a 301 redirect when a story's slug changes", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Rename Author");

    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Original Title ${runSuffix}`, description: "d" },
    });
    const story = createStory.json();
    const oldSlug = story.slug;

    const rename = await app.inject({
      method: "PATCH",
      url: `/api/v1/creator/stories/${story.id}`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Renamed Title ${runSuffix}` },
    });
    expect(rename.statusCode).toBe(200);
    const newSlug = rename.json().slug;
    expect(newSlug).not.toBe(oldSlug);

    const redirect = await prisma.redirect.findUnique({ where: { fromPath: `/truyen/${oldSlug}` } });
    expect(redirect?.toPath).toBe(`/truyen/${newSlug}`);
    expect(redirect?.statusCode).toBe(301);
  });

  it("forbids a different creator from editing someone else's story", async () => {
    const owner = await registerAndBecomeCreator("Owner Author");
    const intruder = await registerAndBecomeCreator("Intruder Author");

    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies: owner.cookies,
      headers: { "x-csrf-token": owner.csrfToken },
      payload: { title: "Owned Story", description: "d" },
    });
    const story = createStory.json();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/creator/stories/${story.id}`,
      cookies: intruder.cookies,
      headers: { "x-csrf-token": intruder.csrfToken },
      payload: { title: "Hijacked Title" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("keeps chapter revision history on each body edit (autosave -> content_versions)", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Versioned Author");

    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: "Versioned Story", description: "d" },
    });
    const story = createStory.json();

    const addChapter = await app.inject({
      method: "POST",
      url: `/api/v1/creator/stories/${story.id}/chapters`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: "Chapter 1", bodyHtml: "<p>v1</p>" },
    });
    const chapter = addChapter.json();

    await app.inject({
      method: "PATCH",
      url: `/api/v1/creator/chapters/${chapter.id}`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { bodyHtml: "<p>v2</p>" },
    });

    const versions = await prisma.contentVersion.findMany({ where: { contentPartId: chapter.id }, orderBy: { versionNumber: "asc" } });
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});

describe("Categories", () => {
  it("lets a creator create a category and assign it to their story", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Category Author");

    const createCategory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/categories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { name: `Tiên Hiệp ${runSuffix}` },
    });
    expect(createCategory.statusCode).toBe(201);
    const category = createCategory.json();

    const list = await app.inject({ method: "GET", url: "/api/v1/creator/categories", cookies });
    expect(list.json().categories.map((c: { id: string }) => c.id)).toContain(category.id);

    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Category Story ${runSuffix}`, description: "d", categoryIds: [category.id] },
    });
    expect(createStory.statusCode).toBe(201);
    const story = createStory.json();
    expect(story.categories).toHaveLength(1);
    expect(story.categories[0].category.id).toBe(category.id);
  });

  it("returns the same category instead of a duplicate when the name already exists (case-insensitive)", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Dedup Author");
    const name = `Kiếm Hiệp ${runSuffix}`;

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/creator/categories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { name },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/creator/categories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { name: name.toUpperCase() },
    });

    expect(first.json().id).toBe(second.json().id);
  });

  it("rejects a story update with a category id that doesn't exist", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Bad Category Author");
    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Bad Category Story ${runSuffix}`, description: "d" },
    });
    const story = createStory.json();

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/creator/stories/${story.id}`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { categoryIds: ["00000000-0000-0000-0000-000000000000"] },
    });
    expect(update.statusCode).toBe(422);
  });
});

describe("GET /api/v1/creator/wallet", () => {
  it("returns available/pending/paid balances, never a bare single number", async () => {
    const { cookies } = await registerAndBecomeCreator("Wallet Author");
    const response = await app.inject({ method: "GET", url: "/api/v1/creator/wallet", cookies });
    const body = response.json();
    expect(body).toHaveProperty("availableCents");
    expect(body).toHaveProperty("pendingCents");
    expect(body).toHaveProperty("paidCents");
  });
});

describe("Dashboard listing endpoints", () => {
  it("lists only the current creator's own stories, including drafts", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Listing Author");
    await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Listing Story ${Date.now()}`, description: "d" },
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/creator/stories", cookies });
    const body = response.json();
    expect(body.stories.length).toBeGreaterThanOrEqual(1);
    expect(body.stories[0].status).toBe("DRAFT");
  });

  it("lists a story's chapters for its owner", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Chapter Listing Author");
    const createStory = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Chapter Listing Story ${Date.now()}`, description: "d" },
    });
    const story = createStory.json();

    await app.inject({
      method: "POST",
      url: `/api/v1/creator/stories/${story.id}/chapters`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: "Chapter 1", bodyHtml: "<p>x</p>" },
    });

    const response = await app.inject({ method: "GET", url: `/api/v1/creator/stories/${story.id}/chapters`, cookies });
    expect(response.json().chapters).toHaveLength(1);
  });
});
