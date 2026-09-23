import { describe, expect, it } from "vitest";
import { buildLlmsTxt, buildLlmsFullTxt } from "./llms";

const config = { siteUrl: "https://example.com", siteName: "ContentHub", defaultLocale: "vi" };

describe("buildLlmsTxt", () => {
  const txt = buildLlmsTxt(config);

  it("describes the site and public URL patterns using the configured domain", () => {
    expect(txt).toContain("# ContentHub");
    expect(txt).toContain("https://example.com/truyen/{slug}");
    expect(txt).toContain("https://example.com/truyen/{slug}/{part-slug}");
    expect(txt).toContain("https://example.com/tin-tuc/{slug}");
  });

  it("never includes private API or database schema details", () => {
    expect(txt.toLowerCase()).not.toContain("wallet");
    expect(txt.toLowerCase()).not.toContain("password");
    expect(txt.toLowerCase()).not.toContain("database");
    expect(txt.toLowerCase()).not.toContain("prisma");
  });

  it("never references a URL that doesn't correspond to a real route (no dead links for crawlers/LLMs to follow)", () => {
    expect(txt).not.toContain("/lien-he");
  });
});

describe("buildLlmsFullTxt", () => {
  const stats = {
    totalPublicStories: 42,
    totalPublicCategories: 5,
    totalPublicAuthors: 10,
    topCategories: [{ name: "Tiên hiệp", slug: "tien-hiep" }],
  };
  const txt = buildLlmsFullTxt(config, stats);

  it("includes aggregate counts, not per-record dumps", () => {
    expect(txt).toContain("42");
    expect(txt).toContain("Tiên hiệp");
  });

  it("never includes sensitive data", () => {
    expect(txt.toLowerCase()).not.toContain("email");
    expect(txt.toLowerCase()).not.toContain("revenue");
    expect(txt.toLowerCase()).not.toContain("moderation");
  });
});
