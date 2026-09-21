# Architecture

## Style: modular monolith

ContentHub runs as two deployables — `apps/api` and `apps/web` — sharing a
set of internal packages under `packages/*`. It is **not** microservices:
there is one Postgres database, one Redis instance, and both apps import
the same `packages/database` Prisma client. What makes it "modular" rather
than "a pile of code that imports Prisma everywhere":

- **Every domain concept lives in exactly one package.** Revenue math is in
  `packages/revenue`, never duplicated in `apps/api`. SEO URL-building is in
  `packages/seo`, imported by both `apps/web` (for HTML) and `apps/api`
  (implicitly, since the API never needs to know about `/truyen/...` paths —
  only the web app does).
- **Packages depend downward, never sideways or up.** `packages/database`
  has no dependencies on any other `@contenthub/*` package. `packages/auth`,
  `packages/seo`, `packages/search`, `packages/storage` depend only on
  `packages/shared` and (where they need persistence) `packages/database`.
  `packages/revenue`, `packages/analytics`, `packages/moderation` depend on
  `packages/database` and sometimes each other in one direction
  (`analytics` → `revenue`, for the aggregation worker's qualification
  logic). Nothing in `packages/*` imports from `apps/*`.
- **Each package's public surface is its `src/index.ts` barrel export.**
  Internal files (`session.ts`, `ledger.ts`, ...) are implementation detail;
  consumers only import from `@contenthub/<package>`.

If a specific domain (revenue calculation, or search) ever needs to become
its own deployed service, the target package's public interface is already
the seam: give it its own process, keep the same exported functions/types,
and change how `apps/api` reaches it (in-process call → RPC/HTTP call). No
other package needs to change.

## Why not microservices from day one

The spec explicitly asks for this. A UGC platform's core workflow (create →
publish → read → count a view → pay a Creator) is a single, tightly
consistent transaction graph in its early life — splitting it into services
before there's a operational reason to (independent scaling, independent
deploy cadence, a team boundary) adds distributed-transaction and
eventual-consistency complexity for no benefit yet. The `RevenueTransaction`
/ `WalletTransaction` ledger pattern, the `ContentEvent` → queue → worker →
`ContentView` aggregation pipeline, and the package boundaries described
above are the concrete pieces of a monolith-to-services migration that
*are* worth paying for up front, because retrofitting them later (turning
direct writes into an event log, turning a shared-transaction write into an
idempotent message) is much more expensive than building them in from the
start.

## Core domain

```
User
 └── CreatorProfile (1:1, created when a user "becomes a Creator")
      ├── Content (n)              -- polymorphic: type = STORY | ARTICLE | COMIC | VIDEO | AUDIO | PODCAST
      │    ├── Story (1:1)         -- type-specific extension, only STORY is enabled today
      │    ├── ContentPart (n)     -- a chapter (STORY), a section/episode for other types later
      │    │    └── ContentVersion (n)   -- revision history, one row per save
      │    ├── ContentCategory / ContentTag (n:n)
      │    ├── SeoMetadata (1:1)
      │    └── Redirect (n)        -- 301s created when a slug changes
      ├── Wallet (1:1)
      │    └── WalletTransaction (n)      -- immutable ledger; Wallet.balance* are a cache of this
      ├── CreatorRevenue (n)               -- one row per (RevenuePool, Creator[, Content])
      ├── PayoutAccount (n) → Payout (n)
      └── Follow (n, as target)

ContentEvent (n)  -- raw, short-retention view events (from /api/v1/events/view)
  → aggregation worker →
ContentView (n)   -- daily rollup per (Content, ContentPart): raw/valid/qualified/monetized counts

RevenueConfig (versioned) → RevenuePool (one per YYYY-MM) → RevenueTransaction (immutable ledger)
```

**Why `Content` is polymorphic instead of `stories` being the core table:**
the spec is explicit that the system must not be designed "around stories."
`Content` carries everything every content type needs (title, slug,
status, visibility, language, publishedAt, creator, categories, tags,
views, revenue, SEO metadata). `Story` is a narrow 1:1 extension table
holding only what's STORY-specific (`subtitle`, `ageRating`). Adding
`ARTICLE` later means: add an `ARTICLE` value to the `ContentType` enum,
add an `Article` extension table, add an `apps/web` route that renders it,
and add API endpoints under `/creator/articles`. `ContentPart`,
`ContentView`, `RevenueTransaction`, `SeoMetadata`, `Comment`, `Like`,
`Follow` — none of that changes, because they're keyed on `Content`, not on
`Story`.

## Folder structure

```
apps/
  web/    Next.js App Router. Public pages are Server Components that query
          packages/database directly (no HTTP round-trip to apps/api for
          reads — see "Why the web app reads Prisma directly" below).
          The dashboard is a separate, client-rendered route tree that talks
          to apps/api over fetch(), so dashboard/editor code never ships in
          a reader's page bundle.
  api/    Fastify REST API. Owns every write path (auth, creator CRUD,
          moderation actions would live here) and the public JSON API.

packages/
  database/    prisma/schema.prisma is the single source of truth for the
               schema. `src/index.ts` exports a singleton PrismaClient plus
               every Prisma-generated type (enums, model types).
  shared/      Pure functions with no I/O: slugify (Unicode-aware),
               truncateText (never splits a code point), countWords /
               estimateReadingTimeMinutes, cursor pagination, integer-cents
               money math with lossless percentage splitting.
  auth/        Password hashing (scrypt), session tokens (opaque, hash-only
               persistence), JWT (for non-cookie clients), RBAC rank
               checks, CSRF double-submit tokens, IP/session hashing.
  seo/         Every public-facing URL/metadata/JSON-LD/robots/sitemap/
               llms.txt concern in one place — see docs/SEO.md.
  search/      `SearchProvider` interface + `PostgresSearchProvider`.
  storage/     `StorageProvider` interface + `S3StorageProvider`, upload
               MIME/size validation, semantic filename generation.
  revenue/     View qualification (RAW→VALID→QUALIFIED→MONETIZED), revenue
               pool splitting, per-creator allocation, the wallet ledger,
               `PaymentProvider` interface.
  analytics/   View event zod schema, BullMQ producer, the aggregation
               worker function that turns raw events into `ContentView` rows.
  moderation/  Report lifecycle + moderation actions, always audit-logged.
```

### Why the web app reads Prisma directly instead of calling the API

Public pages must be server-rendered with the content already in the HTML
response (SEO-first, spec §8). Two ways to get there: `apps/web` calls
`apps/api` over HTTP from its Server Components (an extra network hop, extra
serialization, and a second place that has to reimplement "what does
PUBLISHED+PUBLIC+non-deleted mean"), or `apps/web` queries
`packages/database` directly, the same way `apps/api`'s public routes do.
This repo does the latter for reads. Every **write** from a browser
(register, publish, autosave, ...) still goes through `apps/api`, because
that's where auth, CSRF, and RBAC are enforced — the dashboard is a REST
client like any other. If `apps/web` and `apps/api` are ever split onto
different hosts (see "Why not microservices" above), the fix is
mechanical: swap the `packages/database` calls in `apps/web/src/lib/
public-data.ts` for calls to `apps/api`'s public endpoints, which already
exist and are already tested.

## Request flow: publishing a chapter

1. Creator types in the TipTap editor (`apps/web`, Client Component). Every
   change updates local word count/reading time (`packages/shared`).
2. After a debounce, the client calls `POST /api/v1/creator/stories/:id/chapters`
   (or `PATCH .../chapters/:id`) with a CSRF header and the session cookie.
3. `apps/api` verifies the session (`packages/auth`), verifies the caller
   owns the story, computes word count/reading time server-side (never
   trusts the client's numbers), writes the `ContentPart` row, and appends
   a `ContentVersion` row in the same transaction.
4. Creator clicks Publish → `POST .../chapters/:id/publish` flips
   `ContentPart.status` to `PUBLISHED` (or `SCHEDULED` with a `scheduledAt`,
   for a worker to flip later — see "Implementation status").
5. The next request to `/truyen/[slug]/[chapter]` (`apps/web`, Server
   Component) reads the now-published row straight from Postgres and
   renders full HTML — no cache to invalidate for correctness, though a
   cache layer can sit in front for performance (docs/DEPLOYMENT.md).

## Request flow: a reader's view becoming revenue

1. Reader loads a chapter page. A small client script (not built as part of
   this pass — see below) would call `POST /api/v1/events/view` with
   `{ contentId, contentPartId, sessionId, duration, scrollDepth }`.
2. `apps/api` validates the payload (`packages/analytics`' zod schema — the
   client can describe engagement, never claim a qualification stage),
   hashes the session id and IP, and enqueues a `content-view-events`
   BullMQ job. The HTTP response is `202 Accepted` immediately; nothing is
   written to Postgres synchronously per request (spec §36, §82 rule 8).
3. A worker (not wired into `docker-compose.yml` yet — see
   "Implementation status") drains the queue and calls
   `aggregateViewEventsBatch` (`packages/analytics`), which runs each event
   through `qualifyView` (`packages/revenue`) and upserts daily
   `ContentView` counters.
4. At period close, an admin/cron job (not built) reads `ContentView`
   totals, calls `splitRevenuePool` + `allocateCreatorPool`
   (`packages/revenue`) using the current `RevenueConfig`, and writes
   `RevenueTransaction` + `WalletTransaction` rows via `WalletLedger`.
5. The creator's `/dashboard/wallet` and `/dashboard/revenue` pages show the
   resulting available/pending/paid balances — always from the ledger, never
   from a mutable "balance" field treated as the source of truth.

## Implementation status

Everything above the "Deliberately out of scope" line in the README is
implemented and has passing tests against a real Postgres. Explicitly not
built in this pass, and why:

| Not built | Why it's safe to defer | What exists instead |
|---|---|---|
| A running BullMQ worker process | The queue, the job payload, and the aggregation function are all real and tested (`packages/analytics`); only the "run this in a loop" process wrapper and its `docker-compose.yml` service are missing. | `aggregateViewEventsBatch` is a plain exported function — wiring a `Worker` around it is a few lines. |
| Revenue period lifecycle automation (OPEN→CALCULATING→FRAUD_REVIEW→FINALIZED→PAYOUT_AVAILABLE) | The `RevenuePool.status` enum and the calculation functions exist; the state machine that walks a period through these stages on a schedule doesn't. | `splitRevenuePool`/`allocateCreatorPool`/`WalletLedger` (`packages/revenue`). |
| Fraud/bot detection beyond view-qualification thresholds | Out of scope for an MVP; the qualification pipeline has the seam (`RawViewEvent.isSuspectedBot`) for a real detector to plug into. | `qualifyView` treats every non-bot-flagged session as valid/qualified per duration+scroll thresholds. |
| A real `PaymentProvider` (bank transfer/Stripe/etc.) | The interface is the point — swapping providers shouldn't touch calling code. | `ManualPaymentProvider` (records payouts as pending for back-office processing). |
| Admin dashboard UI | The underlying logic (moderation actions, revenue config, SEO health data) is implemented in `packages/moderation` / `packages/revenue` and covered by tests; there's no `/admin` screen calling it yet. | Direct package/API usage. |
| OpenSearch `SearchProvider` | `PostgresSearchProvider` is the MVP implementation the spec calls for; the interface (`packages/search`) is what a second implementation would satisfy. | `PostgresSearchProvider`. |
| Client-side view-event beacon in the reader page | The ingestion endpoint (`POST /api/v1/events/view`) is built and tested; the `apps/web` reader page doesn't yet call it. | — |
| 410 Gone distinction in `apps/web` pages | `apps/api`'s public routes correctly return 410 for soft-deleted content vs. 404 for never-existed (tested). Server Components can only call `notFound()` (always 404) without middleware; that middleware wasn't built this pass. | API-level 404/410 tests. |
