export interface ApiConfig {
  port: number;
  corsOrigins: string[];
  sessionCookieName: string;
  sessionSecret: string;
  sessionTtlDays: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  ipHashSecret: string;
  redisUrl: string;
}

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 16) {
    throw new Error("SESSION_SECRET must be set to a value at least 16 characters long.");
  }

  return {
    port: Number(env.API_PORT ?? 4000),
    corsOrigins: (env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()),
    sessionCookieName: env.SESSION_COOKIE_NAME ?? "ch_session",
    sessionSecret,
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
    rateLimitMax: Number(env.RATE_LIMIT_MAX ?? 100),
    rateLimitWindowMs: Number(env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    ipHashSecret: env.SESSION_SECRET ?? sessionSecret,
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
  };
}
