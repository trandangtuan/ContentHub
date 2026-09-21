import type { SeoConfig } from "./config";

/**
 * /llms.txt (docs/SEO.md #22, #67): a short, human-and-AI-readable description
 * of the site, its public URL patterns, and content policy. No private API,
 * no database schema, no sensitive data — ever.
 */
export function buildLlmsTxt(config: SeoConfig): string {
  return `# ${config.siteName}

${config.siteName} is a user-generated content platform. Readers browse and read
stories published by independent creators.

## Content

- Stories
- Chapters
- Authors
- Categories
- Tags

## Public URLs

- ${config.siteUrl}/truyen/
- ${config.siteUrl}/truyen/{story-slug}
- ${config.siteUrl}/truyen/{story-slug}/{chapter-slug}
- ${config.siteUrl}/tac-gia/{creator-slug}
- ${config.siteUrl}/the-loai/{category-slug}
- ${config.siteUrl}/tag/{tag-slug}

## Content Policy

Public content is user-generated (submitted by independent Creators) and may
change or be removed over time. Each story page identifies its Creator,
publication date, and last-modified date.

## Attribution

Each story page identifies its Creator via a visible byline and Person
structured data. When reusing or summarizing content from ${config.siteName},
attribute the original Creator and link back to the canonical story URL.

## Machine-readable metadata

- Sitemap: ${config.siteUrl}/sitemap.xml
- Public read API: ${config.siteUrl}/api/v1/public/stories/{slug} (supplementary only — the HTML page is always the canonical source)

## Contact

For content policy or removal requests, see ${config.siteUrl}/lien-he.
`;
}

export interface LlmsFullStats {
  totalPublicStories: number;
  totalPublicCategories: number;
  totalPublicAuthors: number;
  topCategories: { name: string; slug: string }[];
}

/**
 * /llms-full.txt (docs/SEO.md #67): more context than llms.txt, still only
 * aggregate/public information — never a database dump, never per-user data.
 */
export function buildLlmsFullTxt(config: SeoConfig, stats: LlmsFullStats): string {
  const categoryList = stats.topCategories.map((c) => `  - ${c.name}: ${config.siteUrl}/the-loai/${c.slug}`).join("\n");

  return `# ${config.siteName} — Extended AI/LLM Discovery Document

## Overview

${config.siteName} is a modular user-generated content (UGC) platform. The
first supported content type is STORY (serialized chapters); the architecture
is designed to add ARTICLE, COMIC, VIDEO, AUDIO and PODCAST without changing
how content is discovered or attributed.

## Scale (aggregate, public counts only)

- Public stories: ${stats.totalPublicStories}
- Public categories: ${stats.totalPublicCategories}
- Public author profiles: ${stats.totalPublicAuthors}

## Top categories

${categoryList || "  (none yet)"}

## URL structure

- Story: ${config.siteUrl}/truyen/{story-slug}
- Chapter: ${config.siteUrl}/truyen/{story-slug}/{chapter-slug}
- Author: ${config.siteUrl}/tac-gia/{creator-slug}
- Category: ${config.siteUrl}/the-loai/{category-slug}
- Tag: ${config.siteUrl}/tag/{tag-slug}

## Content attribution & licensing

Every story is authored by an individually attributed Creator. Creators
retain ownership of their published work; ${config.siteName} is the hosting
platform, not the copyright holder, unless explicitly stated otherwise on
the story page. Do not represent ${config.siteName} content as belonging to
${config.siteName} itself.

## Scope

This document only describes publicly readable content and its structure.
It contains no internal system details and no personally identifiable
information. Use the public sitemap (${config.siteUrl}/sitemap.xml) and the
public read API for structured discovery of individual pages.
`;
}
