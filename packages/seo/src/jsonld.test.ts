import { describe, expect, it } from "vitest";
import { buildBookJsonLd, buildPersonOrOrganizationJsonLd, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "./jsonld";

const config = { siteUrl: "https://example.com", siteName: "ContentHub", defaultLocale: "vi" };

describe("buildBookJsonLd", () => {
  it("produces a valid schema.org Book with nested Person author", () => {
    const jsonld = buildBookJsonLd(config, {
      name: "Tu Tiên 1000 Năm",
      description: "Mô tả",
      authorName: "Nguyễn Văn An",
      authorUrl: "https://example.com/tac-gia/nguyen-van-an",
      inLanguage: "vi",
    });
    expect(jsonld["@context"]).toBe("https://schema.org");
    expect(jsonld["@type"]).toBe("Book");
    expect(jsonld.author).toEqual({ "@type": "Person", name: "Nguyễn Văn An", url: "https://example.com/tac-gia/nguyen-van-an" });
    expect(jsonld.inLanguage).toBe("vi");
  });
});

describe("buildPersonOrOrganizationJsonLd", () => {
  it("defaults to Person", () => {
    const jsonld = buildPersonOrOrganizationJsonLd({ name: "Nguyễn Văn An", url: "https://example.com/tac-gia/x" });
    expect(jsonld["@type"]).toBe("Person");
  });

  it("uses Organization when isOrganization is true", () => {
    const jsonld = buildPersonOrOrganizationJsonLd({ name: "Studio X", url: "https://example.com/tac-gia/x", isOrganization: true });
    expect(jsonld["@type"]).toBe("Organization");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("builds a positioned ListItem chain with absolute URLs", () => {
    const jsonld = buildBreadcrumbJsonLd(config, [
      { name: "Trang chủ", path: "/" },
      { name: "Truyện", path: "/truyen" },
      { name: "Tu Tiên 1000 Năm", path: "/truyen/tu-tien-1000-nam" },
    ]);
    expect(jsonld["@type"]).toBe("BreadcrumbList");
    expect(jsonld.itemListElement).toHaveLength(3);
    expect(jsonld.itemListElement[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "Tu Tiên 1000 Năm",
      item: "https://example.com/truyen/tu-tien-1000-nam",
    });
  });
});

describe("buildWebPageJsonLd", () => {
  it("nests the WebSite via isPartOf", () => {
    const jsonld = buildWebPageJsonLd(config, { name: "Trang chủ", description: "d", path: "/" });
    expect(jsonld["@type"]).toBe("WebPage");
    expect(jsonld.isPartOf).toEqual({ "@type": "WebSite", name: "ContentHub", url: "https://example.com" });
  });
});
