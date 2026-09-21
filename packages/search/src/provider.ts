/**
 * SearchProvider abstraction (docs/SEO.md/#55, spec #55). MVP implements this
 * with Postgres full-text search over contents.search_vector; swapping to
 * OpenSearch/Elasticsearch later means writing a new class against this same
 * interface — no caller changes.
 */
export interface SearchResultItem {
  contentId: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  coverImage: string | null;
  creatorSlug: string;
  creatorName: string;
  rank: number;
}

export interface SearchQuery {
  text: string;
  limit?: number;
  offset?: number;
}

export interface SearchResults {
  items: SearchResultItem[];
  total: number;
}

export interface SearchProvider {
  search(query: SearchQuery): Promise<SearchResults>;
}
