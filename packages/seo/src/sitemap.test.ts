import { describe, expect, it } from "vitest";
import { buildSitemapXml, buildSitemapIndexXml, buildStaticPagesEntries, MAX_URLS_PER_SITEMAP, type SitemapProvider } from "./sitemap";

const config = { siteUrl: "https://example.com", siteName: "ContentHub", defaultLocale: "vi" };

describe("buildSitemapXml", () => {
  it("emits loc + lastmod only, no changefreq/priority", () => {
    const xml = buildSitemapXml([{ loc: "https://example.com/truyen/x", lastmod: "2026-01-01T00:00:00.000Z" }]);
    expect(xml).toContain("<loc>https://example.com/truyen/x</loc>");
    expect(xml).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
    expect(xml).not.toContain("changefreq");
    expect(xml).not.toContain("priority");
  });

  it("escapes XML special characters in loc", () => {
    const xml = buildSitemapXml([{ loc: "https://example.com/truyen/a&b", lastmod: "2026-01-01" }]);
    expect(xml).toContain("a&amp;b");
  });
});

describe("buildSitemapIndexXml", () => {
  it("lists each child sitemap with loc + lastmod", () => {
    const xml = buildSitemapIndexXml([
      { loc: "https://example.com/sitemap-stories-1.xml", lastmod: "2026-01-01" },
      { loc: "https://example.com/sitemap-chapters-1.xml", lastmod: "2026-01-02" },
    ]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("sitemap-stories-1.xml");
    expect(xml).toContain("sitemap-chapters-1.xml");
  });
});

describe("buildStaticPagesEntries", () => {
  it("includes the core static pages", () => {
    const entries = buildStaticPagesEntries(config, "2026-01-01");
    const locs = entries.map((e) => e.loc);
    expect(locs).toContain("https://example.com/");
    expect(locs).toContain("https://example.com/truyen");
    expect(locs).toContain("https://example.com/tac-gia");
    expect(locs).toContain("https://example.com/the-loai");
  });
});

describe("MAX_URLS_PER_SITEMAP", () => {
  it("stays comfortably under Google's 50,000 URL limit", () => {
    expect(MAX_URLS_PER_SITEMAP).toBeLessThan(50_000);
  });
});

describe("SitemapProvider (contract test with an in-memory fake)", () => {
  it("supports cursor pagination without loading everything at once", async () => {
    const allUrls = Array.from({ length: 25 }, (_, i) => ({ loc: `https://example.com/truyen/story-${i}`, lastmod: "2026-01-01" }));
    const pageSize = 10;

    const provider: SitemapProvider = {
      key: "stories",
      async getUrls(cursor?: string) {
        const start = cursor ? Number(cursor) : 0;
        const slice = allUrls.slice(start, start + pageSize);
        const nextCursor = start + pageSize < allUrls.length ? String(start + pageSize) : null;
        return { entries: slice, nextCursor };
      },
    };

    let cursor: string | undefined;
    const collected: string[] = [];
    do {
      const page = await provider.getUrls(cursor);
      collected.push(...page.entries.map((e) => e.loc));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(collected).toHaveLength(25);
    expect(collected[0]).toBe("https://example.com/truyen/story-0");
    expect(collected[24]).toBe("https://example.com/truyen/story-24");
  });
});
