import { loadSeoConfigFromEnv, type SeoConfig } from "@contenthub/seo";

let cached: SeoConfig | null = null;

/** Cached per-process — env doesn't change at runtime, no need to re-parse on every request. */
export function getSeoConfig(): SeoConfig {
  if (!cached) cached = loadSeoConfigFromEnv();
  return cached;
}
