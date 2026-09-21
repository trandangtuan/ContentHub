import type { PrismaClient } from "@contenthub/database";
import type { SearchProvider, SearchQuery, SearchResults } from "./provider";

interface Row {
  content_id: string;
  slug: string;
  title: string;
  short_description: string | null;
  cover_image: string | null;
  creator_slug: string;
  creator_name: string;
  rank: number;
  total_count: bigint;
}

/**
 * MVP SearchProvider: Postgres tsvector/GIN full-text search (spec #55).
 * Only searches title/short_description/description (via the generated
 * search_vector — see migration 002), never chapter bodies with LIKE.
 * Only PUBLISHED + PUBLIC + non-deleted content is searchable.
 */
export class PostgresSearchProvider implements SearchProvider {
  constructor(private readonly db: PrismaClient) {}

  async search({ text, limit = 20, offset = 0 }: SearchQuery): Promise<SearchResults> {
    const query = text.trim();
    if (!query) return { items: [], total: 0 };

    const rows = await this.db.$queryRaw<Row[]>`
      SELECT
        c.id AS content_id,
        c.slug,
        c.title,
        c.short_description,
        c.cover_image,
        cp.slug AS creator_slug,
        cp.display_name AS creator_name,
        ts_rank(c.search_vector, plainto_tsquery('simple', ${query})) AS rank,
        count(*) OVER() AS total_count
      FROM contents c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      WHERE c.status = 'PUBLISHED'
        AND c.visibility = 'PUBLIC'
        AND c.deleted_at IS NULL
        AND c.search_vector @@ plainto_tsquery('simple', ${query})
      ORDER BY rank DESC, c.published_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return {
      items: rows.map((row) => ({
        contentId: row.content_id,
        slug: row.slug,
        title: row.title,
        shortDescription: row.short_description,
        coverImage: row.cover_image,
        creatorSlug: row.creator_slug,
        creatorName: row.creator_name,
        rank: Number(row.rank),
      })),
      total: rows.length > 0 ? Number(rows[0]!.total_count) : 0,
    };
  }
}
