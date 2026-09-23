import type { SeoConfig } from "./config";

export interface RobotsDirective {
  index: boolean;
  follow: boolean;
}

const INDEX_FOLLOW: RobotsDirective = { index: true, follow: true };
const NOINDEX_NOFOLLOW: RobotsDirective = { index: false, follow: false };
const NOINDEX_FOLLOW: RobotsDirective = { index: false, follow: true };

export function toRobotsMetaValue(directive: RobotsDirective): string {
  return `${directive.index ? "index" : "noindex"}, ${directive.follow ? "follow" : "nofollow"}`;
}

/**
 * getRobotsMetadata(page) (docs/SEO.md #30). Every public-facing route must
 * run its entity through this instead of assuming "public routes are always
 * indexable" — a PUBLISHED+PUBLIC content is indexable, everything else isn't.
 */
export type IndexablePage =
  | { kind: "content"; status: string; visibility: string; seoNoindex?: boolean }
  | { kind: "dashboard" }
  | { kind: "admin" }
  | { kind: "auth" }
  | { kind: "static-indexable" } // homepage, category/author list pages, etc.
  | { kind: "thin-taxonomy" }; // a tag/category page without enough content to be worth indexing (docs/SEO.md #45)

export function getRobotsMetadata(page: IndexablePage): RobotsDirective {
  switch (page.kind) {
    case "content": {
      if (page.seoNoindex) return NOINDEX_FOLLOW;
      const isPublished = page.status === "PUBLISHED";
      const isPublic = page.visibility === "PUBLIC";
      return isPublished && isPublic ? INDEX_FOLLOW : NOINDEX_NOFOLLOW;
    }
    case "dashboard":
    case "admin":
    case "auth":
      return NOINDEX_NOFOLLOW;
    case "static-indexable":
      return INDEX_FOLLOW;
    case "thin-taxonomy":
      return NOINDEX_FOLLOW;
    default:
      return NOINDEX_NOFOLLOW;
  }
}

export interface RobotsTxtOptions {
  /** Extra user-agents to explicitly disallow entirely, beyond the standard private-area rules (docs/SEO.md #68 — AI crawlers are allowed by default). */
  disallowedAgents?: string[];
}

/**
 * Builds robots.txt content. Public content (/truyen, /tac-gia, /the-loai) is
 * always crawlable; private areas (/dashboard, /api, /admin, /auth,
 * /login, /register) are always blocked. The sitemap URL is derived from
 * config, never hard-coded (docs/SEO.md #21).
 */
export function buildRobotsTxt(config: SeoConfig, options: RobotsTxtOptions = {}): string {
  const lines: string[] = [
    "User-agent: *",
    "Allow: /truyen/",
    "Allow: /tac-gia/",
    "Allow: /the-loai/",
    "Allow: /tag/",
    "Allow: /tin-tuc/",
    "Disallow: /dashboard/",
    "Disallow: /api/",
    "Disallow: /admin/",
    "Disallow: /auth/",
    "Disallow: /login/",
    "Disallow: /register/",
    "",
  ];

  for (const agent of options.disallowedAgents ?? []) {
    lines.push(`User-agent: ${agent}`, "Disallow: /", "");
  }

  lines.push(`Sitemap: ${config.siteUrl}/sitemap.xml`);

  return lines.join("\n");
}
