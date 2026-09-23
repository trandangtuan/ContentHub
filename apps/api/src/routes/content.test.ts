import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

const app = buildApp(loadApiConfig());

const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function uniqueEmail(label: string) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `content-test-${safeLabel}-${Date.now()}-${Math.random().toString(36).slice(2)}@contenthub.dev`;
}

async function registerAndBecomeCreator(displayName: string) {
  const email = uniqueEmail(displayName);
  const register = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName } });
  const cookie = register.cookies.find((c) => c.name === "ch_session")!;
  const cookies = { [cookie.name]: cookie.value };

  const session = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies });
  const csrfToken = session.json().csrfToken as string;

  await app.inject({ method: "POST", url: "/api/v1/creator/profile", cookies, headers: { "x-csrf-token": csrfToken }, payload: { displayName } });

  return { cookies, csrfToken };
}

/**
 * A "single" partsMode type (ARTICLE — "tin tức") served entirely by the
 * generic registerContentTypeRoutes/registerPublicContentTypeRoutes
 * (routes/content.ts, routes/public.ts) — no type-specific route code.
 * The STORY ("multi") shape is already covered end-to-end by
 * creator.test.ts's "Story + chapter lifecycle" against the same generic
 * implementation, so this file focuses on what's specific to "single".
 */
describe("Article (tin tức) — a 'single' partsMode ContentType", () => {
  it("lets a creator draft, edit and publish a news article in one step (no separate chapter)", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("News Author");

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/creator/articles",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `Tin tức hàng ngày ${runSuffix}`, bodyHtml: "<p>" + "word ".repeat(120) + "</p>" },
    });
    expect(create.statusCode).toBe(201);
    const article = create.json();
    expect(article.status).toBe("DRAFT");
    expect(article.visibility).toBe("PRIVATE");
    expect(article.slug).toBe(`tin-tuc-hang-ngay-${runSuffix}`);
    expect(article.parts).toHaveLength(1);
    expect(article.parts[0].wordCount).toBe(120);

    // Not publicly visible until published.
    const beforePublish = await app.inject({ method: "GET", url: `/api/v1/public/articles/${article.slug}` });
    expect(beforePublish.statusCode).toBe(404);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/creator/articles/${article.id}`,
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { description: "Bản tin thử nghiệm", bodyHtml: "<p>updated body</p>" },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().parts[0].bodyHtml).toBe("<p>updated body</p>");

    const publish = await app.inject({ method: "POST", url: `/api/v1/creator/articles/${article.id}/publish`, cookies, headers: { "x-csrf-token": csrfToken } });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().status).toBe("PUBLISHED");

    const afterPublish = await app.inject({ method: "GET", url: `/api/v1/public/articles/${article.slug}` });
    expect(afterPublish.statusCode).toBe(200);
    expect(afterPublish.json().bodyHtml).toBe("<p>updated body</p>");

    const listed = await app.inject({ method: "GET", url: "/api/v1/public/articles" });
    expect(listed.json().items.some((a: { slug: string }) => a.slug === article.slug)).toBe(true);

    // A "single" type has no addressable parts route — it has no chapters to list.
    const chaptersAttempt = await app.inject({ method: "GET", url: `/api/v1/public/articles/${article.slug}/chapters` });
    expect(chaptersAttempt.statusCode).toBe(404);
  });

  it("rejects publishing an article with no body", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Empty News Author");

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/creator/articles",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: "Empty Article" },
    });
    const article = create.json();

    const publish = await app.inject({ method: "POST", url: `/api/v1/creator/articles/${article.id}/publish`, cookies, headers: { "x-csrf-token": csrfToken } });
    expect(publish.statusCode).toBe(422);
  });

  it("forbids a different creator from editing or deleting someone else's article", async () => {
    const owner = await registerAndBecomeCreator("Article Owner");
    const intruder = await registerAndBecomeCreator("Article Intruder");

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/creator/articles",
      cookies: owner.cookies,
      headers: { "x-csrf-token": owner.csrfToken },
      payload: { title: "Owned Article", bodyHtml: "<p>x</p>" },
    });
    const article = create.json();

    const patchAttempt = await app.inject({
      method: "PATCH",
      url: `/api/v1/creator/articles/${article.id}`,
      cookies: intruder.cookies,
      headers: { "x-csrf-token": intruder.csrfToken },
      payload: { title: "Hijacked" },
    });
    expect(patchAttempt.statusCode).toBe(403);

    const deleteAttempt = await app.inject({
      method: "DELETE",
      url: `/api/v1/creator/articles/${article.id}`,
      cookies: intruder.cookies,
      headers: { "x-csrf-token": intruder.csrfToken },
    });
    expect(deleteAttempt.statusCode).toBe(403);
  });

  it("an /creator/articles/:id lookup 404s for a story id — types never cross-resolve", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Cross Type Author");

    const story = await app.inject({
      method: "POST",
      url: "/api/v1/creator/stories",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: "Not An Article", description: "d" },
    });
    const storyId = story.json().id;

    const crossLookup = await app.inject({ method: "GET", url: `/api/v1/creator/articles/${storyId}`, cookies });
    expect(crossLookup.statusCode).toBe(404);
  });

  it("deletes an article (soft delete): drops out of the public list and 410s on direct lookup", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("Delete News Author");

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/creator/articles",
      cookies,
      headers: { "x-csrf-token": csrfToken },
      payload: { title: `To Be Deleted ${runSuffix}`, bodyHtml: "<p>x</p>" },
    });
    const article = create.json();
    await app.inject({ method: "POST", url: `/api/v1/creator/articles/${article.id}/publish`, cookies, headers: { "x-csrf-token": csrfToken } });

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/v1/creator/articles/${article.id}`, cookies, headers: { "x-csrf-token": csrfToken } });
    expect(deleteRes.statusCode).toBe(204);

    const getDeleted = await app.inject({ method: "GET", url: `/api/v1/creator/articles/${article.id}`, cookies });
    expect(getDeleted.statusCode).toBe(404);

    const publicRoute = await app.inject({ method: "GET", url: `/api/v1/public/articles/${article.slug}` });
    expect(publicRoute.statusCode).toBe(410);
  });
});
