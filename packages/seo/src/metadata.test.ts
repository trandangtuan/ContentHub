import { describe, expect, it } from "vitest";
import { titleTemplates, buildStoryDescription, buildChapterDescription, buildPageMetadata } from "./metadata";

const config = { siteUrl: "https://example.com", siteName: "ContentHub", defaultLocale: "vi" };

describe("titleTemplates", () => {
  it("formats story/chapter/author titles per the spec templates", () => {
    expect(titleTemplates.story("Tu Tiên 1000 Năm", "ContentHub")).toBe("Tu Tiên 1000 Năm – ContentHub");
    expect(titleTemplates.chapter("Chương 25", "Tu Tiên 1000 Năm", "ContentHub")).toBe(
      "Chương 25 – Tu Tiên 1000 Năm – ContentHub",
    );
    expect(titleTemplates.author("Nguyễn Văn An", "ContentHub")).toBe("Nguyễn Văn An – Truyện và tác phẩm – ContentHub");
  });
});

describe("buildStoryDescription", () => {
  it("uses the story description when present", () => {
    expect(buildStoryDescription("Một câu chuyện hấp dẫn.", "short")).toBe("Một câu chuyện hấp dẫn.");
  });

  it("falls back to shortDescription when description is empty", () => {
    expect(buildStoryDescription(null, "Mô tả ngắn.")).toBe("Mô tả ngắn.");
  });

  it("truncates a long description without cutting mid-word", () => {
    const long = "Từ ".repeat(100);
    const result = buildStoryDescription(long, null);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it("returns empty string when nothing is available", () => {
    expect(buildStoryDescription(null, undefined)).toBe("");
  });
});

describe("buildChapterDescription", () => {
  it("never uses the full chapter content, only an excerpt", () => {
    const fullChapterText = "A".repeat(5000);
    const result = buildChapterDescription("Chương 1", "Tu Tiên 1000 Năm", fullChapterText);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it("includes chapter title and story title", () => {
    const result = buildChapterDescription("Chương 1", "Tu Tiên 1000 Năm", "Một khởi đầu mới.");
    expect(result).toContain("Chương 1");
    expect(result).toContain("Tu Tiên 1000 Năm");
  });
});

describe("buildPageMetadata", () => {
  it("assembles canonical/robots/openGraph/twitter from inputs", () => {
    const meta = buildPageMetadata(config, {
      title: "Tu Tiên 1000 Năm – ContentHub",
      description: "Mô tả truyện.",
      path: "/truyen/tu-tien-1000-nam",
      robots: { index: true, follow: true },
      ogImage: "https://example.com/cover.webp",
      ogType: "book",
    });

    expect(meta.alternates.canonical).toBe("https://example.com/truyen/tu-tien-1000-nam");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph.url).toBe("https://example.com/truyen/tu-tien-1000-nam");
    expect(meta.openGraph.images[0]!.url).toBe("https://example.com/cover.webp");
    expect(meta.twitter.card).toBe("summary_large_image");
  });

  it("falls back to a default OG image when none is provided", () => {
    const meta = buildPageMetadata(config, {
      title: "t",
      description: "d",
      path: "/truyen/x",
      robots: { index: true, follow: true },
      ogType: "book",
    });
    expect(meta.openGraph.images[0]!.url).toBe("https://example.com/og-default.png");
  });
});
