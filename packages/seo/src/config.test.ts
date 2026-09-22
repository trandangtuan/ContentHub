import { describe, expect, it } from "vitest";
import { loadSeoConfigFromEnv } from "./config";

describe("loadSeoConfigFromEnv", () => {
  it("throws when SITE_URL is missing entirely", () => {
    expect(() => loadSeoConfigFromEnv({})).toThrow(/must be set/);
  });

  it("reads SITE_URL, strips a trailing slash", () => {
    const config = loadSeoConfigFromEnv({ SITE_URL: "https://contenthub.tdshift.info/" });
    expect(config.siteUrl).toBe("https://contenthub.tdshift.info");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL when SITE_URL is unset", () => {
    const config = loadSeoConfigFromEnv({ NEXT_PUBLIC_SITE_URL: "https://contenthub.tdshift.info" });
    expect(config.siteUrl).toBe("https://contenthub.tdshift.info");
  });

  it("rejects the example.com placeholder in production (the #1 real deploy mistake: unedited .env.example)", () => {
    expect(() => loadSeoConfigFromEnv({ SITE_URL: "https://example.com", NODE_ENV: "production" })).toThrow(/placeholder/);
  });

  it("rejects a bare localhost SITE_URL in production", () => {
    expect(() => loadSeoConfigFromEnv({ SITE_URL: "http://localhost:3000", NODE_ENV: "production" })).toThrow(/placeholder/);
  });

  it("allows example.com outside production (tests/dev fixtures)", () => {
    expect(() => loadSeoConfigFromEnv({ SITE_URL: "https://example.com", NODE_ENV: "test" })).not.toThrow();
  });

  it("allows a real domain in production", () => {
    const config = loadSeoConfigFromEnv({ SITE_URL: "https://contenthub.tdshift.info", NODE_ENV: "production" });
    expect(config.siteUrl).toBe("https://contenthub.tdshift.info");
  });
});
