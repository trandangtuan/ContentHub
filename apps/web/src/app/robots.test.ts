import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots()", () => {
  const result = robots();

  it("allows public content paths and disallows private areas", () => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcard = rules.find((r) => r.userAgent === "*");
    expect(wildcard).toBeDefined();
    expect(wildcard?.allow).toEqual(expect.arrayContaining(["/truyen/", "/tac-gia/", "/the-loai/", "/tag/"]));
    expect(wildcard?.disallow).toEqual(expect.arrayContaining(["/dashboard/", "/api/", "/admin/", "/auth/", "/login/", "/register/"]));
  });

  it("declares the sitemap using the configured domain", () => {
    expect(result.sitemap).toBe("https://example.com/sitemap.xml");
  });

  it("does not block AI crawlers by default (no ROBOTS_DISALLOWED_AGENTS set)", () => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules).toHaveLength(1);
  });
});
