import type { SeoConfig } from "./config";
import { buildCanonicalUrl } from "./canonical";

/** JSON-LD builders (docs/SEO.md #14-17). Only emit a schema when it truly reflects the page — never spam. */

export interface BookJsonLdInput {
  name: string;
  description: string;
  image?: string;
  authorName: string;
  authorUrl: string;
  inLanguage: string;
  datePublished?: string;
  dateModified?: string;
}

export function buildBookJsonLd(config: SeoConfig, input: BookJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: input.name,
    description: input.description,
    ...(input.image ? { image: input.image } : {}),
    author: { "@type": "Person", name: input.authorName, url: input.authorUrl },
    inLanguage: input.inLanguage,
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    publisher: { "@type": "Organization", name: config.siteName, url: config.siteUrl },
  };
}

/** Use for content types where Book doesn't fit (e.g. Article) — never force Book onto non-book content. */
export function buildCreativeWorkJsonLd(config: SeoConfig, input: BookJsonLdInput & { additionalType?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    ...(input.additionalType ? { additionalType: input.additionalType } : {}),
    name: input.name,
    description: input.description,
    ...(input.image ? { image: input.image } : {}),
    author: { "@type": "Person", name: input.authorName, url: input.authorUrl },
    inLanguage: input.inLanguage,
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    publisher: { "@type": "Organization", name: config.siteName, url: config.siteUrl },
  };
}

export interface ArticleJsonLdInput {
  headline: string;
  description: string;
  image?: string;
  authorName: string;
  authorUrl: string;
  inLanguage: string;
  datePublished?: string;
  dateModified?: string;
}

/** NewsArticle (schema.org): the correct type for a daily-news "tin tức" post — Book/CreativeWork don't fit. */
export function buildNewsArticleJsonLd(config: SeoConfig, input: ArticleJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: input.headline,
    description: input.description,
    ...(input.image ? { image: [input.image] } : {}),
    author: { "@type": "Person", name: input.authorName, url: input.authorUrl },
    inLanguage: input.inLanguage,
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    publisher: {
      "@type": "Organization",
      name: config.siteName,
      url: config.siteUrl,
      logo: { "@type": "ImageObject", url: `${config.siteUrl}/og-default.png` },
    },
  };
}

export interface PersonJsonLdInput {
  name: string;
  url: string;
  image?: string;
  isOrganization?: boolean;
}

export function buildPersonOrOrganizationJsonLd(input: PersonJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": input.isOrganization ? "Organization" : "Person",
    name: input.name,
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string; // relative path, e.g. "/truyen/tu-tien-1000-nam"
}

export function buildBreadcrumbJsonLd(config: SeoConfig, items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(config, item.path),
    })),
  };
}

export function buildWebPageJsonLd(config: SeoConfig, input: { name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url: buildCanonicalUrl(config, input.path),
    isPartOf: { "@type": "WebSite", name: config.siteName, url: config.siteUrl },
  };
}
