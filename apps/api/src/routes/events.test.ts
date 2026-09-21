import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadApiConfig } from "../config.js";

const app = buildApp(loadApiConfig());

describe("POST /api/v1/events/view", () => {
  it("accepts a well-formed view event and returns 202 (async, not written synchronously)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events/view",
      payload: {
        contentId: "123e4567-e89b-12d3-a456-426614174000",
        contentPartId: "123e4567-e89b-12d3-a456-426614174001",
        sessionId: "a-random-session-id-1234",
        event: "CONTENT_VIEW",
        timestamp: new Date().toISOString(),
        duration: 35,
        scrollDepth: 0.62,
      },
    });
    expect(response.statusCode).toBe(202);
  });

  it("rejects a malformed event (bad contentId) with 422", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events/view",
      payload: { contentId: "not-a-uuid", sessionId: "s", event: "CONTENT_VIEW", timestamp: new Date().toISOString() },
    });
    expect(response.statusCode).toBe(422);
  });

  it("ignores a client-supplied qualification/monetization claim — no such field exists in the schema", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events/view",
      payload: {
        contentId: "123e4567-e89b-12d3-a456-426614174000",
        sessionId: "a-random-session-id-1234",
        event: "CONTENT_VIEW",
        timestamp: new Date().toISOString(),
        qualified: true,
        monetized: true,
        revenueCents: 999999,
      },
    });
    expect(response.statusCode).toBe(202);
  });
});
