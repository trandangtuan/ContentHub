import { paths } from "./canonical";
import type { BreadcrumbItem } from "./jsonld";

/** Breadcrumb trails (docs/SEO.md #16, #28) shared by the JSON-LD builder and the rendered <nav> breadcrumb. */
export const breadcrumbs = {
  story(storyTitle: string, storySlug: string): BreadcrumbItem[] {
    return [
      { name: "Trang chủ", path: paths.home() },
      { name: "Truyện", path: paths.storyList() },
      { name: storyTitle, path: paths.story(storySlug) },
    ];
  },

  chapter(storyTitle: string, storySlug: string, chapterTitle: string, chapterSlug: string): BreadcrumbItem[] {
    return [
      ...breadcrumbs.story(storyTitle, storySlug),
      { name: chapterTitle, path: paths.chapter(storySlug, chapterSlug) },
    ];
  },

  author(authorName: string, authorSlug: string): BreadcrumbItem[] {
    return [
      { name: "Trang chủ", path: paths.home() },
      { name: "Tác giả", path: paths.authorList() },
      { name: authorName, path: paths.author(authorSlug) },
    ];
  },

  category(categoryName: string, categorySlug: string): BreadcrumbItem[] {
    return [
      { name: "Trang chủ", path: paths.home() },
      { name: "Thể loại", path: paths.categoryList() },
      { name: categoryName, path: paths.category(categorySlug) },
    ];
  },

  tag(tagName: string, tagSlug: string): BreadcrumbItem[] {
    return [
      { name: "Trang chủ", path: paths.home() },
      { name: `Tag: ${tagName}`, path: paths.tag(tagSlug) },
    ];
  },
};
