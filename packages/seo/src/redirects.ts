/**
 * Slug-change redirect handling (docs/SEO.md #31-32). When a creator renames
 * a story/chapter slug, the API layer must write one of these records before
 * the slug itself changes — never let the old URL start 404ing.
 */
export interface RedirectRecord {
  fromPath: string;
  toPath: string;
  statusCode: 301;
}

export function buildSlugChangeRedirect(oldPath: string, newPath: string): RedirectRecord {
  if (oldPath === newPath) {
    throw new Error("Cannot create a redirect from a path to itself");
  }
  return { fromPath: oldPath, toPath: newPath, statusCode: 301 };
}

export type NotFoundReason = "never-existed" | "permanently-deleted" | "temporarily-unavailable";

/**
 * Maps a content lifecycle reason to the correct HTTP status (docs/SEO.md
 * #32): permanently deleted content is 410 Gone (tells crawlers to drop it),
 * not a redirect to the homepage.
 */
export function resolveNotFoundStatus(reason: NotFoundReason): 404 | 410 {
  return reason === "permanently-deleted" ? 410 : 404;
}
