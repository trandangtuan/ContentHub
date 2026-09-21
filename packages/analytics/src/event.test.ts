import { describe, expect, it } from "vitest";
import { viewEventSchema } from "./event";

const valid = {
  contentId: "123e4567-e89b-12d3-a456-426614174000",
  contentPartId: "123e4567-e89b-12d3-a456-426614174001",
  sessionId: "a-random-session-id",
  event: "CONTENT_VIEW" as const,
  timestamp: new Date().toISOString(),
  duration: 35,
  scrollDepth: 0.62,
};

describe("viewEventSchema", () => {
  it("accepts a well-formed event", () => {
    expect(viewEventSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid contentId", () => {
    expect(viewEventSchema.safeParse({ ...valid, contentId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a scrollDepth outside [0,1]", () => {
    expect(viewEventSchema.safeParse({ ...valid, scrollDepth: 1.5 }).success).toBe(false);
  });

  it("rejects a duration that couldn't plausibly happen (> 24h)", () => {
    expect(viewEventSchema.safeParse({ ...valid, duration: 100_000 }).success).toBe(false);
  });

  it("does not accept a client-supplied qualification stage — the schema has no such field", () => {
    const withFraudulentField = { ...valid, qualified: true, monetized: true };
    const parsed = viewEventSchema.parse(withFraudulentField);
    expect(parsed).not.toHaveProperty("qualified");
    expect(parsed).not.toHaveProperty("monetized");
  });
});
