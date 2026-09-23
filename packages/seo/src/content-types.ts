/**
 * Single source of truth for every publishable ContentType (docs/
 * ARCHITECTURE.md's polymorphic Content design). Adding a new type that
 * fits one of the two existing shapes — `multi` (an ordered, independently
 * publishable ContentPart per unit, like a Story's chapters) or `single`
 * (exactly one ContentPart created with its Content, like an Article's
 * body) — means adding one entry here. Nothing else in apps/api or apps/web
 * hard-codes a URL prefix, a nav label, or a JSON-LD choice per type; they
 * all read this list.
 */

export type ContentTypeKey = "STORY" | "ARTICLE";

export interface ContentTypeConfig {
  /** Matches the Prisma `ContentType` enum value. */
  type: ContentTypeKey;
  /** Public URL segment: /{urlPrefix}, /{urlPrefix}/{slug}, /{urlPrefix}/{slug}/{partSlug}. */
  urlPrefix: string;
  /** Creator API resource name: /creator/{apiResource}[/:id[/...]]. */
  apiResource: string;
  /** Creator API resource name for this type's parts (multi only): /creator/{partsApiResource}/:id. */
  partsApiResource?: string;
  /** Nav label / section heading. */
  label: string;
  /** Singular label for buttons ("+ Thêm {itemLabel} mới"). */
  itemLabel: string;
  /** Label for one part/unit (multi only) — "Chương" for a Story chapter. */
  partLabel?: string;
  /**
   * "multi": an ordered set of independently-drafted/published ContentParts
   * (chapters) — the item itself is metadata + a parts list.
   * "single": exactly one ContentPart, created together with its Content and
   * never separately listed — the item *is* its one part.
   */
  partsMode: "single" | "multi";
  /** Which JSON-LD shape best fits this type on its detail page. */
  jsonLd: "book" | "newsArticle";
}

export const CONTENT_TYPES: readonly ContentTypeConfig[] = [
  {
    type: "STORY",
    urlPrefix: "truyen",
    apiResource: "stories",
    partsApiResource: "chapters",
    label: "Truyện",
    itemLabel: "truyện",
    partLabel: "Chương",
    partsMode: "multi",
    jsonLd: "book",
  },
  {
    type: "ARTICLE",
    urlPrefix: "tin-tuc",
    apiResource: "articles",
    label: "Tin tức",
    itemLabel: "tin",
    partsMode: "single",
    jsonLd: "newsArticle",
  },
];

export function contentTypeByPrefix(urlPrefix: string): ContentTypeConfig | undefined {
  return CONTENT_TYPES.find((c) => c.urlPrefix === urlPrefix);
}

export function contentTypeByKey(type: string): ContentTypeConfig | undefined {
  return CONTENT_TYPES.find((c) => c.type === type);
}

/** The fixed ContentPart slug for every "single" type's one-and-only part — never rendered in a URL. */
export const SINGLE_PART_SLUG = "content";
