# ContentHub

A user-generated content (UGC) platform. Readers register, become Creators,
publish content, readers read it, the platform measures qualified views,
and revenue flows back to Creators through a transparent ledger.

**Status: MVP.** The first content type is `STORY` (serialized chapters).
The core domain (`User` → `Creator` → `Content` → `ContentPart` → `View` →
`Revenue` → `Wallet` → `Payout`) is designed so `ARTICLE`, `COMIC`, `VIDEO`,
`AUDIO`, and `PODCAST` can be added later without rewriting the schema or
the API — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — modular monolith, module boundaries, folder structure
- [DATABASE.md](docs/DATABASE.md) — ERD, table-by-table design, indexing
- [SEO.md](docs/SEO.md) — canonical URLs, metadata, JSON-LD, sitemap, robots, llms.txt
- [REVENUE.md](docs/REVENUE.md) — view qualification pipeline, revenue pool, wallet ledger, payouts
- [API.md](docs/API.md) — REST API reference
- [SECURITY.md](docs/SECURITY.md) — auth, RBAC, CSRF, sanitization, upload validation
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — Docker Compose (dev), production architecture

## Project structure

```
apps/
  web/          Next.js App Router — public SSR site + Creator Studio dashboard
  api/           Fastify REST API — auth, creator CRUD, public reads, event ingestion

packages/
  database/      Prisma schema + client (single source of truth for the schema)
  shared/        slug/text/pagination/money utilities used everywhere
  auth/          password hashing, sessions, JWT, RBAC, CSRF
  seo/           canonical/robots/metadata/JSON-LD/sitemap/breadcrumbs/llms.txt/redirects
  search/        SearchProvider abstraction (Postgres FTS today, OpenSearch-ready)
  storage/       S3-compatible StorageProvider + upload validation
  revenue/       view qualification, revenue pool allocation, wallet ledger, PaymentProvider
  analytics/     view event schema, BullMQ producer, aggregation worker
  moderation/    reports + moderation actions with audit trail
```

## Quickstart (local, without Docker)

Requires Node 20+, pnpm, a local PostgreSQL 16 and Redis.

```bash
pnpm install
cp .env.example .env               # edit DATABASE_URL/REDIS_URL/SESSION_SECRET as needed
pnpm --filter @contenthub/database migrate       # applies migrations to $DATABASE_URL
pnpm --filter @contenthub/database seed          # optional: seed a demo creator + story

pnpm --filter @contenthub/api dev    # API on :4000
pnpm --filter @contenthub/web dev    # web on :3000
```

## Quickstart (Docker Compose)

```bash
cp .env.example .env
# .env must set SESSION_SECRET to a real secret before compose will start.
docker compose up -d --build
```

This starts `postgres`, `redis`, `api` (:4000), and `web` (:3000). The API
container runs `prisma migrate deploy` on every start, so the schema is
always current; seed data is not applied automatically — run
`pnpm --filter @contenthub/database seed` against the compose Postgres if
you want the demo story.

> Docker builds were written and verified against `next build`/`tsc` in this
> repo's dev sandbox, but the sandbox's network policy blocks pulling base
> images from Docker Hub, so `docker compose up --build` itself has not been
> run end-to-end here. Please verify it in an environment with normal
> registry access before relying on it.

## Testing

Every package and app has its own `test` script (Vitest). Most tests that
touch the database run against a real local Postgres — set
`DATABASE_URL`/`TEST_DATABASE_URL` per `.env.example` before running:

```bash
pnpm -r test        # run every package/app's test suite
pnpm -r typecheck    # tsc --noEmit everywhere
```

## What's implemented vs. scoped for later

Implemented and tested: auth, creator profiles, story/chapter CRUD with
autosave/revisions, publish/unpublish/schedule, public SSR reader,
SEO surface (metadata, JSON-LD, canonical, robots.txt, sitemap index,
llms.txt), Postgres full-text search, view-event ingestion queue + daily
aggregation, revenue pool splitting + wallet ledger math, moderation
reports/actions with audit trail, and an admin console (`/admin`) covering
users, cross-creator story moderation, reports, versioned revenue
configuration, wallet adjustments, payouts, and SEO health — every
mutation there goes through the same audited moderation-action / wallet-
ledger code paths as everywhere else (see docs/ARCHITECTURE.md's "Admin
surface").

Deliberately out of scope for this pass (see docs/ARCHITECTURE.md
"Implementation status" for the full list and why): a running BullMQ worker
process wired into `docker-compose.yml`, fraud/bot detection beyond the
qualification thresholds, real payment-provider integrations (a
`ManualPaymentProvider` stands in), revenue-period lifecycle automation
(OPEN→...→FINALIZED runs by admin action today, not a scheduler), and an
OpenSearch `SearchProvider` implementation (the interface is ready for
one).
