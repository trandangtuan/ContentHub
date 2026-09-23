import { paths } from "./canonical";
import type { BreadcrumbItem } from "./jsonld";
import type { ContentTypeConfig } from "./content-types";

/** Breadcrumb trails (docs/SEO.md #16, #28) shared by the JSON-LD builder and the rendered <nav> breadcrumb. */
export const breadcrumbs = {
  /** Generic for any ContentType: Trang chủ -> {section label} -> {item title}. */
  item(config: ContentTypeConfig, itemTitle: string, itemSlug: string): BreadcrumbItem[] {
    return [
      { name: "Trang chủ", path: paths.home() },
      { name: config.label, path: paths.section(config.urlPrefix) },
      { name: itemTitle, path: paths.item(config.urlPrefix, itemSlug) },
    ];
  },

  /** Adds a part (chapter) crumb — only meaningful for a "multi" type. */
  part(config: ContentTypeConfig, itemTitle: string, itemSlug: string, partTitle: string, partSlug: string): BreadcrumbItem[] {
    return [...breadcrumbs.item(config, itemTitle, itemSlug), { name: partTitle, path: paths.part(config.urlPrefix, itemSlug, partSlug) }];
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
