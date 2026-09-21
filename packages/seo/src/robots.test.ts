import { describe, expect, it } from "vitest";
import { getRobotsMetadata, buildRobotsTxt, toRobotsMetaValue } from "./robots";

const config = { siteUrl: "https://example.com", siteName: "ContentHub", defaultLocale: "vi" };

describe("getRobotsMetadata", () => {
  it("indexes a published public story", () => {
    const directive = getRobotsMetadata({ kind: "content", status: "PUBLISHED", visibility: "PUBLIC" });
    expect(directive).toEqual({ index: true, follow: true });
  });

  it("noindexes a draft story", () => {
    expect(getRobotsMetadata({ kind: "content", status: "DRAFT", visibility: "PUBLIC" })).toEqual({
      index: false,
      follow: false,
    });
  });

  it("noindexes a private story even if published", () => {
    expect(getRobotsMetadata({ kind: "content", status: "PUBLISHED", visibility: "PRIVATE" })).toEqual({
      index: false,
      follow: false,
    });
  });

  it("respects an explicit seoNoindex override on an otherwise-indexable story", () => {
    expect(getRobotsMetadata({ kind: "content", status: "PUBLISHED", visibility: "PUBLIC", seoNoindex: true })).toEqual({
      index: false,
      follow: true,
    });
  });

  it("always noindexes dashboard/admin/auth", () => {
    expect(getRobotsMetadata({ kind: "dashboard" })).toEqual({ index: false, follow: false });
    expect(getRobotsMetadata({ kind: "admin" })).toEqual({ index: false, follow: false });
    expect(getRobotsMetadata({ kind: "auth" })).toEqual({ index: false, follow: false });
  });

  it("indexes static pages and noindexes thin taxonomy pages", () => {
    expect(getRobotsMetadata({ kind: "static-indexable" })).toEqual({ index: true, follow: true });
    expect(getRobotsMetadata({ kind: "thin-taxonomy" })).toEqual({ index: false, follow: true });
  });
});

describe("toRobotsMetaValue", () => {
  it("formats the directive as a meta robots content string", () => {
    expect(toRobotsMetaValue({ index: true, follow: true })).toBe("index, follow");
    expect(toRobotsMetaValue({ index: false, follow: false })).toBe("noindex, nofollow");
  });
});

describe("buildRobotsTxt", () => {
  const txt = buildRobotsTxt(config);

  it("allows public content paths", () => {
    expect(txt).toContain("Allow: /truyen/");
    expect(txt).toContain("Allow: /tac-gia/");
    expect(txt).toContain("Allow: /the-loai/");
  });

  it("disallows private areas", () => {
    expect(txt).toContain("Disallow: /dashboard/");
    expect(txt).toContain("Disallow: /api/");
    expect(txt).toContain("Disallow: /admin/");
    expect(txt).toContain("Disallow: /auth/");
    expect(txt).toContain("Disallow: /login/");
    expect(txt).toContain("Disallow: /register/");
  });

  it("declares the sitemap using the configured domain, never hard-coded", () => {
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("does not block AI crawlers by default", () => {
    expect(txt).not.toMatch(/User-agent: GPTBot/);
    expect(txt).not.toMatch(/User-agent: ClaudeBot/);
  });

  it("allows opting in to blocking specific crawlers via config", () => {
    const restricted = buildRobotsTxt(config, { disallowedAgents: ["BadBot"] });
    expect(restricted).toContain("User-agent: BadBot\nDisallow: /");
  });
});
