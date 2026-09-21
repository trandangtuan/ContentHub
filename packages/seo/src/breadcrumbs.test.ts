import { describe, expect, it } from "vitest";
import { breadcrumbs } from "./breadcrumbs";

describe("breadcrumbs.chapter", () => {
  it("builds Home > Truyện > Story > Chapter", () => {
    const trail = breadcrumbs.chapter("Tu Tiên 1000 Năm", "tu-tien-1000-nam", "Chương 25", "chuong-25");
    expect(trail.map((t) => t.name)).toEqual(["Trang chủ", "Truyện", "Tu Tiên 1000 Năm", "Chương 25"]);
    expect(trail.at(-1)!.path).toBe("/truyen/tu-tien-1000-nam/chuong-25");
  });
});

describe("breadcrumbs.story", () => {
  it("builds Home > Truyện > Story", () => {
    const trail = breadcrumbs.story("Tu Tiên 1000 Năm", "tu-tien-1000-nam");
    expect(trail).toHaveLength(3);
    expect(trail.at(-1)).toEqual({ name: "Tu Tiên 1000 Năm", path: "/truyen/tu-tien-1000-nam" });
  });
});

describe("breadcrumbs.author / category / tag", () => {
  it("builds their respective trails", () => {
    expect(breadcrumbs.author("Nguyễn Văn An", "nguyen-van-an").at(-1)).toEqual({
      name: "Nguyễn Văn An",
      path: "/tac-gia/nguyen-van-an",
    });
    expect(breadcrumbs.category("Tiên hiệp", "tien-hiep").at(-1)).toEqual({
      name: "Tiên hiệp",
      path: "/the-loai/tien-hiep",
    });
    expect(breadcrumbs.tag("Tu tiên", "tu-tien").at(-1)).toEqual({
      name: "Tag: Tu tiên",
      path: "/tag/tu-tien",
    });
  });
});
