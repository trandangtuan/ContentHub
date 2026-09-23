import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

let uploadsDir: string;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  uploadsDir = await mkdtemp(join(tmpdir(), "contenthub-uploads-test-"));
  app = buildApp(loadApiConfig({ ...process.env, UPLOADS_DIR: uploadsDir }));
});

afterAll(async () => {
  await rm(uploadsDir, { recursive: true, force: true });
});

function uniqueEmail(label: string) {
  return `upload-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@contenthub.dev`;
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

/** Hand-rolled multipart/form-data body — no client library needed for a single file field. */
function buildMultipartPayload(fieldName: string, filename: string, contentType: string, body: Buffer) {
  const boundary = "----contenthubTestBoundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { boundary, payload: Buffer.concat([head, body, tail]) };
}

// A minimal valid 1x1 PNG.
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415478da6360000002000155ac2a950000000049454e44ae426082",
  "hex",
);

describe("POST /api/v1/creator/uploads/:purpose", () => {
  it("requires authentication", async () => {
    const { boundary, payload } = buildMultipartPayload("file", "cover.png", "image/png", TINY_PNG);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/creator/uploads/cover",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(response.statusCode).toBe(401);
  });

  it("requires a valid CSRF token", async () => {
    const { cookies } = await registerAndBecomeCreator("csrf-upload");
    const { boundary, payload } = buildMultipartPayload("file", "cover.png", "image/png", TINY_PNG);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/creator/uploads/cover",
      cookies,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(response.statusCode).toBe(403);
  });

  it("saves a valid cover image and returns its URL", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("cover-upload");
    const { boundary, payload } = buildMultipartPayload("file", "cover.png", "image/png", TINY_PNG);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/creator/uploads/cover",
      cookies,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "x-csrf-token": csrfToken },
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.url).toMatch(/^https?:\/\/.+\/api\/uploads\/cover\/.+\.png$/);
    expect(body.key).toMatch(/^cover\/.+\.png$/);

    const files = await readdir(join(uploadsDir, "cover"));
    expect(files.length).toBeGreaterThan(0);
  });

  it("rejects a disallowed MIME type for the purpose", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("bad-mime-upload");
    const { boundary, payload } = buildMultipartPayload("file", "clip.mp4", "video/mp4", Buffer.from("not really a video"));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/creator/uploads/cover",
      cookies,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "x-csrf-token": csrfToken },
      payload,
    });

    expect(response.statusCode).toBe(422);
  });

  it("rejects an unknown purpose", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("bad-purpose-upload");
    const { boundary, payload } = buildMultipartPayload("file", "cover.png", "image/png", TINY_PNG);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/creator/uploads/banner",
      cookies,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "x-csrf-token": csrfToken },
      payload,
    });

    expect(response.statusCode).toBe(422);
  });

  it("serves the uploaded file back over HTTP", async () => {
    const { cookies, csrfToken } = await registerAndBecomeCreator("serve-upload");
    const { boundary, payload } = buildMultipartPayload("file", "avatar.png", "image/png", TINY_PNG);

    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/creator/uploads/avatar",
      cookies,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "x-csrf-token": csrfToken },
      payload,
    });
    const { key } = upload.json();

    const served = await app.inject({ method: "GET", url: `/api/uploads/${key}` });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");
  });
});
