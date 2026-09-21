import { describe, expect, it } from "vitest";
import { slugify, disambiguateSlug, slugifyWithFallback } from "./slug";

describe("slugify", () => {
  it("converts a Vietnamese title into a URL-safe slug", () => {
    expect(slugify("Tu Tiên 1000 Năm")).toBe("tu-tien-1000-nam");
  });

  it("handles đ/Đ which NFD does not decompose", () => {
    expect(slugify("Đại Đạo Độc Hành")).toBe("dai-dao-doc-hanh");
  });

  it("lowercases and collapses punctuation/whitespace", () => {
    expect(slugify("Hello,   World!!  Foo_Bar")).toBe("hello-world-foo-bar");
  });

  it("trims leading/trailing separators", () => {
    expect(slugify("  --Weird Title--  ")).toBe("weird-title");
  });

  it("is idempotent", () => {
    const once = slugify("Tu Tiên 1000 Năm");
    expect(slugify(once)).toBe(once);
  });
});

describe("disambiguateSlug", () => {
  it("returns the base slug unchanged on the first attempt", () => {
    expect(disambiguateSlug("tu-tien", 0)).toBe("tu-tien");
  });

  it("appends an incrementing suffix on retries", () => {
    expect(disambiguateSlug("tu-tien", 1)).toBe("tu-tien-2");
    expect(disambiguateSlug("tu-tien", 2)).toBe("tu-tien-3");
  });
});

describe("slugifyWithFallback", () => {
  it("uses the primary input when it slugifies to something", () => {
    expect(slugifyWithFallback("Tu Tiên", "id-123")).toBe("tu-tien");
  });

  it("falls back when the input normalizes away to nothing", () => {
    expect(slugifyWithFallback("修仙", "content-id-123")).toBe("content-id-123");
  });
});
