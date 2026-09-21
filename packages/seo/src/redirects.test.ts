import { describe, expect, it } from "vitest";
import { buildSlugChangeRedirect, resolveNotFoundStatus } from "./redirects";

describe("buildSlugChangeRedirect", () => {
  it("builds a 301 redirect record from old path to new path", () => {
    expect(buildSlugChangeRedirect("/truyen/old-slug", "/truyen/new-slug")).toEqual({
      fromPath: "/truyen/old-slug",
      toPath: "/truyen/new-slug",
      statusCode: 301,
    });
  });

  it("refuses to create a redirect to itself", () => {
    expect(() => buildSlugChangeRedirect("/truyen/same", "/truyen/same")).toThrow();
  });
});

describe("resolveNotFoundStatus", () => {
  it("maps permanently deleted content to 410 Gone", () => {
    expect(resolveNotFoundStatus("permanently-deleted")).toBe(410);
  });

  it("maps everything else to 404", () => {
    expect(resolveNotFoundStatus("never-existed")).toBe(404);
    expect(resolveNotFoundStatus("temporarily-unavailable")).toBe(404);
  });
});
