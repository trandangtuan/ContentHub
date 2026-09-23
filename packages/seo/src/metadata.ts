import { truncateText } from "@contenthub/shared";
import type { SeoConfig } from "./config";
import { buildCanonicalUrl } from "./canonical";
import { toRobotsMetaValue, type RobotsDirective } from "./robots";

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

/** Title templates (docs/SEO.md #12). Keep them short — never let a long user title blow the budget silently. */
export const titleTemplates = {
  /** Generic for any ContentType's detail page. */
  item: (itemTitle: string, siteName: string) => truncateText(`${itemTitle} – ${siteName}`, MAX_TITLE_LENGTH + 20),
  /** Generic for a "multi" type's part (chapter) page. */
  part: (partTitle: string, itemTitle: string, siteName: string) =>
    truncateText(`${partTitle} – ${itemTitle} – ${siteName}`, MAX_TITLE_LENGTH + 30),
  author: (authorName: string, siteName: string) =>
    truncateText(`${authorName} – Truyện và tác phẩm – ${siteName}`, MAX_TITLE_LENGTH + 30),
  category: (categoryName: string, siteName: string) => truncateText(`${categoryName} – ${siteName}`, MAX_TITLE_LENGTH + 20),
  tag: (tagName: string, siteName: string) => truncateText(`Tag: ${tagName} – ${siteName}`, MAX_TITLE_LENGTH + 20),
};

/** Item meta description: the creator's description, truncated at a word boundary — never the raw content body. */
export function buildItemDescription(description: string | null | undefined, shortDescription: string | null | undefined): string {
  const source = (description?.trim() || shortDescription?.trim() || "").trim();
  if (!source) return "";
  return truncateText(source, MAX_DESCRIPTION_LENGTH);
}

/**
 * Part (chapter) meta description: part title + item title + a short excerpt
 * — never the full body (docs/SEO.md #13).
 */
export function buildPartDescription(partTitle: string, itemTitle: string, excerptPlainText: string): string {
  const excerpt = truncateText(excerptPlainText.trim(), 90);
  const base = `${partTitle} - ${itemTitle}`;
  return truncateText(excerpt ? `${base}: ${excerpt}` : base, MAX_DESCRIPTION_LENGTH);
}

export interface OpenGraphInput {
  title: string;
  description: string;
  url: string;
  image?: string;
  type: "book" | "profile" | "website" | "article";
}

export interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  robots: RobotsDirective;
  ogImage?: string;
  ogType: OpenGraphInput["type"];
}

/** Next.js `generateMetadata()`-shaped output — spread this directly into the page's metadata export. */
export interface PageMetadata {
  title: string;
  description: string;
  alternates: { canonical: string };
  robots: { index: boolean; follow: boolean };
  openGraph: {
    title: string;
    description: string;
    url: string;
    siteName: string;
    type: string;
    locale: string;
    images: { url: string }[];
  };
  twitter: {
    card: "summary_large_image" | "summary";
    title: string;
    description: string;
    images: string[];
  };
}

export function buildPageMetadata(config: SeoConfig, input: PageMetadataInput): PageMetadata {
  const canonical = buildCanonicalUrl(config, input.path);
  const image = input.ogImage ?? `${config.siteUrl}/og-default.png`;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    robots: { index: input.robots.index, follow: input.robots.follow },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      siteName: config.siteName,
      type: input.ogType,
      locale: config.defaultLocale,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

export { toRobotsMetaValue };
