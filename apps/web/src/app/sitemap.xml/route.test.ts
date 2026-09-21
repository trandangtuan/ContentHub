import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /sitemap.xml (sitemap index)", () => {
  it("returns a valid sitemap index pointing at chunked children", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Type")).toContain("application/xml");

    const xml = await response.text();
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("sitemap-pages.xml");
    expect(xml).toContain("sitemap-authors.xml");
    expect(xml).toContain("sitemap-categories.xml");
    expect(xml).toContain("sitemap-tags.xml");
    // No changefreq/priority (docs/SEO.md #19) — only loc/lastmod carry real information here.
    expect(xml).not.toContain("changefreq");
    expect(xml).not.toContain("priority");
  });
});
