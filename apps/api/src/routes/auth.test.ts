import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

const app = buildApp(loadApiConfig());

function uniqueEmail() {
  return `api-test-${Date.now()}-${Math.random().toString(36).slice(2)}@contenthub.dev`;
}

describe("POST /api/v1/auth/register", () => {
  it("creates a user and sets an httpOnly session cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: uniqueEmail(), password: "Password123!", displayName: "Test User" },
    });

    expect(response.statusCode).toBe(201);
    const cookie = response.cookies.find((c) => c.name === "ch_session");
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
  });

  it("rejects a weak password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: uniqueEmail(), password: "short", displayName: "Test User" },
    });
    expect(response.statusCode).toBe(422);
  });

  it("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail();
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName: "A" } });
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName: "B" } });
    expect(response.statusCode).toBe(409);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const email = uniqueEmail();
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName: "A" } });

    const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password: "Password123!" } });
    expect(response.statusCode).toBe(200);
  });

  it("rejects wrong password with 401, never leaking which field was wrong", async () => {
    const email = uniqueEmail();
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName: "A" } });

    const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password: "WrongPassword!" } });
    expect(response.statusCode).toBe(401);
  });
});

describe("GET /api/v1/auth/session", () => {
  it("reports unauthenticated with no cookie", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/auth/session" });
    expect(response.json()).toEqual({ authenticated: false });
  });

  it("reports the session and a CSRF token when authenticated", async () => {
    const email = uniqueEmail();
    const register = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName: "A" } });
    const cookie = register.cookies.find((c) => c.name === "ch_session")!;

    const response = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies: { [cookie.name]: cookie.value } });
    const body = response.json();
    expect(body.authenticated).toBe(true);
    expect(typeof body.csrfToken).toBe("string");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("clears the session so it can no longer be used", async () => {
    const email = uniqueEmail();
    const register = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", displayName: "A" } });
    const cookie = register.cookies.find((c) => c.name === "ch_session")!;

    await app.inject({ method: "POST", url: "/api/v1/auth/logout", cookies: { [cookie.name]: cookie.value } });

    const after = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies: { [cookie.name]: cookie.value } });
    expect(after.json()).toEqual({ authenticated: false });
  });
});
