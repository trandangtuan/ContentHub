# Deployment

## Local development (Docker Compose)

```bash
cp .env.example .env   # set SESSION_SECRET at minimum
docker compose up -d --build
```

`docker-compose.yml` runs four services: `postgres` (16-alpine, with a
healthcheck other services wait on), `redis` (7-alpine), `api`
(`apps/api/Dockerfile`, port 4000), `web` (`apps/web/Dockerfile`, port
3000). The `api` container runs `prisma migrate deploy` on every start —
safe to re-run, since Prisma tracks which migrations already applied.
Seeding is manual: `pnpm --filter @contenthub/database seed` against the
compose Postgres (`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contenthub_dev`).

**A note on the two Dockerfiles' build strategy:** `packages/*` ship
TypeScript source directly (`package.json` `"main"` points at
`src/index.ts`, no per-package `dist/`). `apps/web`'s Next.js build
transpiles those sources into its bundle at build time
(`transpilePackages` in `next.config.mjs`), so it produces a fully
self-contained `.next` output — no special runtime handling needed.
`apps/api` has no bundler step, so its Docker image runs the API through
`tsx` (already a dependency) rather than `tsc` + `node dist/index.js` —
a compiled `apps/api/dist/index.js` would `require`/`import` a workspace
package and hit its `src/index.ts` entry point, which plain Node can't
execute. This is documented in `apps/api/Dockerfile` itself; giving every
package its own build step (and switching the API image to compiled JS) is
a reasonable hardening step, not a correctness requirement.

**Both Dockerfiles were validated indirectly** (a full `next build` and
`tsc --noEmit` pass locally, and every stage's shell commands were
reasoned through line by line) but **not run end-to-end as `docker build`**
in this repo's dev sandbox — the sandbox's egress policy blocks pulling
`node:20-alpine` from Docker Hub's CDN. Run `docker compose up -d --build`
in a normal environment before depending on it in production.

### Known issue found in a real deployment: Prisma engine vs. Alpine OpenSSL

`web-1` failing with `Error loading shared library libssl.so.1.1: No such
file or directory (needed by .../libquery_engine-linux-musl.so.node)` is
Prisma picking its legacy OpenSSL-1.1-targeting engine binary, which
doesn't exist on `node:20-alpine` (ships OpenSSL 3.x). Fixed by:

1. `packages/database/prisma/schema.prisma`'s `generator client` block
   now sets `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`, so
   `prisma generate` fetches the OpenSSL-3-compatible musl engine instead
   of defaulting to the OpenSSL-1.1 one.
2. Both Dockerfiles' `base` stage now runs `apk add --no-cache openssl` —
   the engine is a separate native binary that dynamically links against
   the *system* libssl, which the base `node:20-alpine` image doesn't
   install on its own even though Node's own bundled OpenSSL works fine.

If you re-build images from an older checkout and hit this, `rm -rf
node_modules/.pnpm/@prisma+client*/node_modules/.prisma` and re-run
`prisma generate` (or just rebuild the Docker image) to pick up the new
`binaryTargets`.

## Production architecture

```
Cloudflare (or any CDN/WAF)
    ↓  HTTPS only (spec §79 — never index http://)
Nginx / Caddy (reverse proxy, TLS termination, gzip/brotli, static cache)
    ↓                              ↓
Next.js (apps/web, :3000)     Fastify API (apps/api, :4000)
    ↓                              ↓
         PostgreSQL 16        Redis (BullMQ + cache)
                                    ↓
                          S3-compatible object storage
```

Points specific to this codebase:

- **www/non-www and http/https canonicalization** happens at the
  Nginx/Caddy or CDN layer (redirect, not a Next.js concern) — `SITE_URL`
  (env) must match whichever canonical host you choose, since every
  canonical tag / sitemap URL / JSON-LD URL is built from it
  (`packages/seo`'s `SeoConfig`). Never point `SITE_URL` at `http://` in
  production.
- **Image optimization**: `apps/web/next.config.mjs` allows any
  `https`/`http` remote host for `next/image` (`remotePatterns: [{
  protocol: "https", hostname: "**" }, ...]`) since cover images live in
  object storage with an operator-chosen domain; tighten this to your
  actual storage domain in production rather than leaving it wildcarded.
- **CDN caching**: public pages (`/truyen/**`, `/tac-gia/**`,
  `/the-loai/**`, `/tag/**`) are safe to cache at the edge; `/dashboard/**`
  and `/api/**` must not be. The reverse proxy layer should set
  `Cache-Control` accordingly (or respect what `apps/web`/`apps/api`
  already send — sitemap/llms.txt routes set
  `Cache-Control: public, max-age=3600`).
- **The BullMQ worker** (view-event aggregation) is not wired into
  `docker-compose.yml` as its own service in this pass — see
  docs/ARCHITECTURE.md's implementation-status table. In production it
  should run as its own process (`node` process calling
  `aggregateViewEventsBatch` in a loop, or a proper BullMQ `Worker`),
  scaled independently of the API's request-handling capacity.

## Environment variables

See `.env.example` for the full list with defaults. Never commit a real
`.env`. Variables with no safe default that **must** be set explicitly in
production: `SITE_URL`, `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`,
`STORAGE_*` (real object storage credentials, not the MinIO dev defaults).
`GOOGLE_SITE_VERIFICATION`/`GA_MEASUREMENT_ID` are optional — Search
Console/Analytics integration is config-driven, never a hard-coded ID in
source (spec §48).

## Migrating a small VPS/EC2 deployment to scale

Everything in "Why not microservices from day one"
(docs/ARCHITECTURE.md) applies here too: start with `docker compose` (or
the equivalent on a single VPS/EC2 instance) running all four services,
Postgres included. The natural first scaling steps, roughly in order of
when you'd need them: move Postgres to a managed instance (RDS/Cloud SQL)
before touching application code; add a read replica once analytics/search
queries compete with write traffic; extract the BullMQ worker to its own
autoscaled process once event volume matters; only then consider splitting
`apps/api` itself, using the `packages/*` boundaries described in
docs/ARCHITECTURE.md as the seams.
