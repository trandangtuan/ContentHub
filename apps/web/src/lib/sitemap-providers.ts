import { prisma } from "@contenthub/database";
import { MAX_URLS_PER_SITEMAP, type SitemapProvider, type SitemapPage, type ContentTypeConfig } from "@contenthub/seo";
import { getSeoConfig } from "./seo-config";

/**
 * One class per URL family (docs/SEO.md #18, #50). Pagination is page-number
 * based (cursor = the page number, as a string) so each request issues a
 * single bounded LIMIT/OFFSET query — never loads the whole table.
 *
 * ContentSitemapProvider/PartSitemapProvider are generic across every
 * ContentType (packages/seo's registry) — a new type reuses them unchanged,
 * parameterized by its config instead of a new provider class.
 */

export class ContentSitemapProvider implements SitemapProvider {
  key: string;

  constructor(private readonly config: ContentTypeConfig) {
    this.key = config.apiResource;
  }

  async getUrls(cursor?: string): Promise<SitemapPage> {
    const page = cursor ? Number(cursor) : 1;
    const { siteUrl } = getSeoConfig();

    const rows = await prisma.content.findMany({
      where: { type: this.config.type, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null },
      orderBy: { id: "asc" },
      skip: (page - 1) * MAX_URLS_PER_SITEMAP,
      take: MAX_URLS_PER_SITEMAP,
      select: { slug: true, updatedAt: true },
    });

    return {
      entries: rows.map((r) => ({ loc: `${siteUrl}/${this.config.urlPrefix}/${r.slug}`, lastmod: r.updatedAt.toISOString() })),
      nextCursor: rows.length === MAX_URLS_PER_SITEMAP ? String(page + 1) : null,
    };
  }

  async pageCount(): Promise<number> {
    const total = await prisma.content.count({ where: { type: this.config.type, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } });
    return Math.max(1, Math.ceil(total / MAX_URLS_PER_SITEMAP));
  }
}

/** Only meaningful for a "multi" partsMode type. */
export class PartSitemapProvider implements SitemapProvider {
  key: string;

  constructor(private readonly config: ContentTypeConfig) {
    this.key = `${config.apiResource}-${config.partsApiResource ?? "parts"}`;
  }

  async getUrls(cursor?: string): Promise<SitemapPage> {
    const page = cursor ? Number(cursor) : 1;
    const { siteUrl } = getSeoConfig();

    const rows = await prisma.contentPart.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        content: { type: this.config.type, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null },
      },
      orderBy: { id: "asc" },
      skip: (page - 1) * MAX_URLS_PER_SITEMAP,
      take: MAX_URLS_PER_SITEMAP,
      select: { slug: true, updatedAt: true, content: { select: { slug: true } } },
    });

    return {
      entries: rows.map((r) => ({ loc: `${siteUrl}/${this.config.urlPrefix}/${r.content.slug}/${r.slug}`, lastmod: r.updatedAt.toISOString() })),
      nextCursor: rows.length === MAX_URLS_PER_SITEMAP ? String(page + 1) : null,
    };
  }

  async pageCount(): Promise<number> {
    const total = await prisma.contentPart.count({
      where: { status: "PUBLISHED", deletedAt: null, content: { type: this.config.type, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } },
    });
    return Math.max(1, Math.ceil(total / MAX_URLS_PER_SITEMAP));
  }
}

export class AuthorSitemapProvider implements SitemapProvider {
  key = "authors";

  async getUrls(cursor?: string): Promise<SitemapPage> {
    const page = cursor ? Number(cursor) : 1;
    const { siteUrl } = getSeoConfig();

    const rows = await prisma.creatorProfile.findMany({
      where: { deletedAt: null, contents: { some: { status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } } },
      orderBy: { id: "asc" },
      skip: (page - 1) * MAX_URLS_PER_SITEMAP,
      take: MAX_URLS_PER_SITEMAP,
      select: { slug: true, updatedAt: true },
    });

    return {
      entries: rows.map((r) => ({ loc: `${siteUrl}/tac-gia/${r.slug}`, lastmod: r.updatedAt.toISOString() })),
      nextCursor: rows.length === MAX_URLS_PER_SITEMAP ? String(page + 1) : null,
    };
  }
}

const publicContentFilter = { status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };
// `_count` must filter to that same public-content shape — an unfiltered
// count would list a category/tag in the sitemap on the strength of
// draft-only content, sending crawlers to a page the page itself noindexes
// (see the matching MIN_ITEMS_TO_INDEX check in the category/tag pages).
const publicContentCountFilter = { where: { content: publicContentFilter } };
const MIN_ITEMS_TO_INDEX = 2;

export class CategorySitemapProvider implements SitemapProvider {
  key = "categories";

  /** Only categories with >=2 public items get an SEO landing page — matters more now that creators can create categories themselves, not just admins. */
  async getUrls(): Promise<SitemapPage> {
    const { siteUrl } = getSeoConfig();
    const rows = await prisma.category.findMany({
      where: { deletedAt: null },
      select: { slug: true, updatedAt: true, _count: { select: { contents: publicContentCountFilter } } },
    });
    const indexable = rows.filter((r) => r._count.contents >= MIN_ITEMS_TO_INDEX);
    return { entries: indexable.map((r) => ({ loc: `${siteUrl}/the-loai/${r.slug}`, lastmod: r.updatedAt.toISOString() })), nextCursor: null };
  }
}

export class TagSitemapProvider implements SitemapProvider {
  key = "tags";

  /** Only tags with >=2 public items get an SEO landing page (docs/SEO.md #45) — thin tags aren't worth indexing. */
  async getUrls(): Promise<SitemapPage> {
    const { siteUrl } = getSeoConfig();
    const rows = await prisma.tag.findMany({
      where: { deletedAt: null },
      select: { slug: true, updatedAt: true, _count: { select: { contents: publicContentCountFilter } } },
    });
    const indexable = rows.filter((r) => r._count.contents >= MIN_ITEMS_TO_INDEX);
    return { entries: indexable.map((r) => ({ loc: `${siteUrl}/tag/${r.slug}`, lastmod: r.updatedAt.toISOString() })), nextCursor: null };
  }
}
