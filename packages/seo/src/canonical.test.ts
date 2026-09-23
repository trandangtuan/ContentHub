import { describe, expect, it } from "vitest";
import { buildCanonicalUrl, paths } from "./canonical";

const config = { siteUrl: "https://example.com", siteName: "ContentHub", defaultLocale: "vi" };

describe("paths", () => {
  it("builds item/part/author/category/tag paths generically by URL prefix", () => {
    expect(paths.section("truyen")).toBe("/truyen");
    expect(paths.item("truyen", "tu-tien-1000-nam")).toBe("/truyen/tu-tien-1000-nam");
    expect(paths.part("truyen", "tu-tien-1000-nam", "chuong-25")).toBe("/truyen/tu-tien-1000-nam/chuong-25");
    expect(paths.author("nguyen-van-an")).toBe("/tac-gia/nguyen-van-an");
    expect(paths.category("tien-hiep")).toBe("/the-loai/tien-hiep");
    expect(paths.tag("tu-tien")).toBe("/tag/tu-tien");
    expect(paths.item("tin-tuc", "tin-cong-nghe-hom-nay")).toBe("/tin-tuc/tin-cong-nghe-hom-nay");
  });
});

describe("buildCanonicalUrl", () => {
  it("builds an absolute URL", () => {
    expect(buildCanonicalUrl(config, "/truyen/tu-tien-1000-nam")).toBe("https://example.com/truyen/tu-tien-1000-nam");
  });

  it("strips utm_source/ref/sort/page query params — canonical never forks", () => {
    expect(buildCanonicalUrl(config, "/truyen?utm_source=fb&ref=x&sort=popular&page=2")).toBe("https://example.com/truyen");
  });

  it("strips trailing slashes except for the homepage", () => {
    expect(buildCanonicalUrl(config, "/truyen/")).toBe("https://example.com/truyen");
    expect(buildCanonicalUrl(config, "/")).toBe("https://example.com/");
  });

  it("strips hash fragments", () => {
    expect(buildCanonicalUrl(config, "/truyen/tu-tien-1000-nam#comments")).toBe(
      "https://example.com/truyen/tu-tien-1000-nam",
    );
  });
});
