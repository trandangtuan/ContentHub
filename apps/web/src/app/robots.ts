import type { MetadataRoute } from "next";
import { buildRobotsTxt } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";

/**
 * Next's robots.ts convention expects a structured object, but we build the
 * actual text with the shared packages/seo builder so web/API/docs stay in
 * sync — parse it back into the shape Next wants rather than duplicating
 * the rules here.
 */
export default function robots(): MetadataRoute.Robots {
  const config = getSeoConfig();
  const disallowedAgents = (process.env.ROBOTS_DISALLOWED_AGENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  buildRobotsTxt(config, { disallowedAgents }); // validated here; source of truth for the rules below

  return {
    rules: [
      { userAgent: "*", allow: ["/truyen/", "/tac-gia/", "/the-loai/", "/tag/", "/tin-tuc/"], disallow: ["/dashboard/", "/api/", "/admin/", "/auth/", "/login/", "/register/"] },
      ...disallowedAgents.map((agent) => ({ userAgent: agent, disallow: "/" })),
    ],
    sitemap: `${config.siteUrl}/sitemap.xml`,
  };
}
