/** Never hard-code the domain/site name in code — always thread it through this config, sourced from env. */
export interface SeoConfig {
  siteUrl: string; // e.g. "https://example.com" (no trailing slash)
  siteName: string;
  defaultLocale: string; // e.g. "vi"
}

// Placeholder domains that must never reach production: copying .env.example
// without editing it is the #1 real-world cause of a live site serving
// "https://example.com" URLs in its own sitemap/canonical/llms.txt.
const PLACEHOLDER_HOSTNAMES = ["example.com", "www.example.com", "localhost"];

export function loadSeoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SeoConfig {
  const siteUrl = (env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (!siteUrl) {
    throw new Error("SITE_URL (or NEXT_PUBLIC_SITE_URL) must be set — SEO URLs must never be hard-coded.");
  }
  if (env.NODE_ENV === "production") {
    const hostname = siteUrl.replace(/^https?:\/\//, "").split(/[/:]/)[0];
    if (hostname && PLACEHOLDER_HOSTNAMES.includes(hostname)) {
      throw new Error(
        `SITE_URL is set to the placeholder "${siteUrl}" — this looks like .env.example was deployed unedited. Set SITE_URL to your real production domain.`,
      );
    }
  }
  return {
    siteUrl,
    siteName: env.SITE_NAME ?? "ContentHub",
    defaultLocale: env.DEFAULT_LOCALE ?? "vi",
  };
}
