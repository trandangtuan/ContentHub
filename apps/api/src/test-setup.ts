process.env.SESSION_SECRET ??= "test-session-secret-please-change-32chars";
process.env.SITE_URL ??= "https://example.com";
process.env.CORS_ORIGINS ??= "http://localhost:3000";
process.env.REDIS_URL ??= "redis://localhost:6379";
// A single test file's `it()` blocks share one `buildApp()` instance (and so
// one rate-limiter bucket), and legitimately issue far more requests in a
// few seconds than the production abuse-prevention default (100/60s) is
// meant to constrain a real client to. Raise the ceiling for tests only —
// this never touches a real deployment's actual RATE_LIMIT_MAX.
process.env.RATE_LIMIT_MAX ??= "10000";
