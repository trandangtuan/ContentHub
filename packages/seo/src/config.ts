/** Never hard-code the domain/site name in code — always thread it through this config, sourced from env. */
export interface SeoConfig {
  siteUrl: string; // e.g. "https://example.com" (no trailing slash)
  siteName: string;
  defaultLocale: string; // e.g. "vi"
}

export function loadSeoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SeoConfig {
  const siteUrl = (env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (!siteUrl) {
    throw new Error("SITE_URL (or NEXT_PUBLIC_SITE_URL) must be set — SEO URLs must never be hard-coded.");
  }
  return {
    siteUrl,
    siteName: env.SITE_NAME ?? "ContentHub",
    defaultLocale: env.DEFAULT_LOCALE ?? "vi",
  };
}
