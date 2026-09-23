import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

const app = buildApp(loadApiConfig());

const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function uniqueEmail(label: string) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `comments-test-${safeLabel}-${Date.now()}-${Math.random().toString(36).slice(2)}@contenthub.dev`;
}

async function registerReader(displayName: string) {
  const email = uniqueEmail(displayName);
  const register = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName } });
  const cookie = register.cookies.find((c) => c.name === "ch_session")!;
  const cookies = { [cookie.name]: cookie.value };

  const session = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies });
  const csrfToken = session.json().csrfToken as string;

  return { cookies, csrfToken };
}

async function registerAndBecomeCreator(displayName: string) {
  const reader = await registerReader(displayName);
  await app.inject({ method: "POST", url: "/api/v1/creator/profile", cookies: reader.cookies, headers: { "x-csrf-token": reader.csrfToken }, payload: { displayName } });
  return reader;
}

async function publishedArticle(title: string) {
  const author = await registerAndBecomeCreator(`${title} Author`);
  const create = await app.inject({
    method: "POST",
    url: "/api/v1/creator/articles",
    cookies: author.cookies,
    headers: { "x-csrf-token": author.csrfToken },
    payload: { title: `${title} ${runSuffix}`, bodyHtml: "<p>x</p>" },
  });
  const article = create.json();
  await app.inject({ method: "POST", url: `/api/v1/creator/articles/${article.id}/publish`, cookies: author.cookies, headers: { "x-csrf-token": author.csrfToken } });
  return article as { id: string; slug: string };
}

describe("Comments — keyed on Content, so any ContentType gets them for free", () => {
  it("requires auth and CSRF to post a comment", async () => {
    const article = await publishedArticle("No Auth");

    const noAuth = await app.inject({ method: "POST", url: `/api/v1/content/${article.id}/comments`, payload: { body: "Bài hay quá" } });
    expect(noAuth.statusCode).toBe(401);

    const reader = await registerReader("No Csrf Reader");
    const noCsrf = await app.inject({ method: "POST", url: `/api/v1/content/${article.id}/comments`, cookies: reader.cookies, payload: { body: "Bài hay quá" } });
    expect(noCsrf.statusCode).toBe(403);
  });

  it("404s posting or listing comments on content that doesn't exist or isn't public", async () => {
    const reader = await registerReader("Ghost Content Reader");
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const list = await app.inject({ method: "GET", url: `/api/v1/content/${fakeId}/comments` });
    expect(list.statusCode).toBe(404);

    const post = await app.inject({ method: "POST", url: `/api/v1/content/${fakeId}/comments`, cookies: reader.cookies, headers: { "x-csrf-token": reader.csrfToken }, payload: { body: "x" } });
    expect(post.statusCode).toBe(404);
  });

  it("lets a logged-in reader post a top-level comment and a reply, but rejects nesting a reply under a reply", async () => {
    const article = await publishedArticle("Thread");
    const alice = await registerReader("Alice");
    const bob = await registerReader("Bob");

    const top = await app.inject({
      method: "POST",
      url: `/api/v1/content/${article.id}/comments`,
      cookies: alice.cookies,
      headers: { "x-csrf-token": alice.csrfToken },
      payload: { body: "Bình luận đầu tiên" },
    });
    expect(top.statusCode).toBe(201);
    const topComment = top.json();
    expect(topComment.depth).toBe(0);
    expect(topComment.author.displayName).toBe("Alice");

    const reply = await app.inject({
      method: "POST",
      url: `/api/v1/content/${article.id}/comments`,
      cookies: bob.cookies,
      headers: { "x-csrf-token": bob.csrfToken },
      payload: { body: "Trả lời bình luận", parentId: topComment.id },
    });
    expect(reply.statusCode).toBe(201);
    expect(reply.json().depth).toBe(1);

    const deepReply = await app.inject({
      method: "POST",
      url: `/api/v1/content/${article.id}/comments`,
      cookies: alice.cookies,
      headers: { "x-csrf-token": alice.csrfToken },
      payload: { body: "Trả lời của trả lời", parentId: reply.json().id },
    });
    expect(deepReply.statusCode).toBe(422);

    const list = await app.inject({ method: "GET", url: `/api/v1/content/${article.id}/comments` });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(topComment.id);
    expect(body.items[0].replies).toHaveLength(1);
    expect(body.items[0].replies[0].author.displayName).toBe("Bob");
  });

  it("lets a reader delete their own comment (soft delete, drops out of the list) but not someone else's", async () => {
    const article = await publishedArticle("Delete Me");
    const alice = await registerReader("Alice Deleter");
    const bob = await registerReader("Bob Bystander");

    const created = await app.inject({
      method: "POST",
      url: `/api/v1/content/${article.id}/comments`,
      cookies: alice.cookies,
      headers: { "x-csrf-token": alice.csrfToken },
      payload: { body: "Sẽ bị xóa" },
    });
    const commentId = created.json().id;

    const forbidden = await app.inject({ method: "DELETE", url: `/api/v1/comments/${commentId}`, cookies: bob.cookies, headers: { "x-csrf-token": bob.csrfToken } });
    expect(forbidden.statusCode).toBe(403);

    const deleted = await app.inject({ method: "DELETE", url: `/api/v1/comments/${commentId}`, cookies: alice.cookies, headers: { "x-csrf-token": alice.csrfToken } });
    expect(deleted.statusCode).toBe(204);

    const list = await app.inject({ method: "GET", url: `/api/v1/content/${article.id}/comments` });
    expect(list.json().items.some((c: { id: string }) => c.id === commentId)).toBe(false);

    const deleteAgain = await app.inject({ method: "DELETE", url: `/api/v1/comments/${commentId}`, cookies: alice.cookies, headers: { "x-csrf-token": alice.csrfToken } });
    expect(deleteAgain.statusCode).toBe(404);
  });
});
