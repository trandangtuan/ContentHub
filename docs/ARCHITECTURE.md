# Architecture

## Style: modular monolith

ContentHub runs as three deployables — `apps/api`, `apps/web`, and
`apps/worker` — sharing a set of internal packages under `packages/*`. It
is **not** microservices: there is one Postgres database, one Redis
instance, and all three apps import the same `packages/database` Prisma
client. What makes it "modular" rather than "a pile of code that imports
Prisma everywhere":

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
      │    │                          .attributes (Json?) holds type-specific scalar metadata
      │    │                          (e.g. STORY's {subtitle, ageRating}) — no per-type table for this
      │    ├── ContentPart (n)     -- every type's body, distinguished only by how many parts it
      │    │    │                     has (packages/seo's content-types registry's `partsMode`):
      │    │    │                     STORY is "multi" (one part per chapter, ordered,
      │    │    │                     independently publishable); ARTICLE is "single" (exactly
      │    │    │                     one part, created with its Content, holding the whole post)
      │    │    └── ContentVersion (n)   -- revision history, one row per save (every type gets this for free)
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
views, revenue, SEO metadata, `attributes`). `ContentView`,
`RevenueTransaction`, `SeoMetadata`, `Comment`, `Like`, `Follow` — none of
that changes per type, because they're keyed on `Content`, not on a
per-type table.

**Adding a new `ContentType`** (`packages/seo/src/content-types.ts`'s
registry is the single source of truth) needs, at minimum, one new entry
there — `{ type, urlPrefix, apiResource, label, itemLabel, partsMode,
jsonLd }` — and nothing else, *if* it fits one of the two existing shapes:

- `partsMode: "multi"` (like STORY): an ordered, independently-published
  set of `ContentPart`s (chapters). The item itself is metadata + a
  separately-managed parts list.
- `partsMode: "single"` (like ARTICLE): exactly one `ContentPart`, created
  together with its `Content` and never separately listed — the item *is*
  its one part.

Because every route family is generated generically from this registry —
`apps/api/src/routes/content.ts`'s `registerContentTypeRoutes`,
`apps/api/src/routes/public.ts`'s `registerPublicContentTypeRoutes`,
`apps/web`'s `app/(public)/[section]/**` and `app/dashboard/[section]/**`
route trees, `apps/web/src/lib/sitemap-providers.ts`'s
`ContentSitemapProvider`/`PartSitemapProvider`, and the nav/robots/llms.txt
generators that loop the registry — a type with only scalar metadata
beyond title/description/cover (stored in `Content.attributes: Json?`,
validated at the API boundary rather than by the DB, the same tradeoff
already made for `ContentPart.bodyJson`) needs **no new migration, no new
route file, and no new React component**: just the registry entry. A type
that needs a genuinely new *rendering shape* (e.g. a VIDEO player) still
needs its own detail-page branch and dashboard editor, but reuses
everything else — ownership checks, publish/unpublish/delete, slugging +
redirects, categories/tags, view tracking, sitemap, JSON-LD dispatch.

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
  worker/ BullMQ worker process. Consumes the content-view-events queue
          and calls packages/analytics' aggregateViewEventsBatch — the
          only place raw view events become ContentView rows. Scales
          independently of apps/api; see docs/DEPLOYMENT.md.

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

1. Reader loads a chapter page. `ChapterViewTracker` (`apps/web`, a tiny
   client component that renders nothing) times the visit and calls
   `POST /api/v1/events/view` via `navigator.sendBeacon` when the reader
   navigates away or hides the tab — not on mount, so `duration`/
   `scrollDepth` reflect actual reading rather than "the page loaded".
2. `apps/api` validates the payload (`packages/analytics`' zod schema — the
   client can describe engagement, never claim a qualification stage),
   hashes the session id and IP, and enqueues a `content-view-events`
   BullMQ job. The HTTP response is `202 Accepted` immediately; nothing is
   written to Postgres synchronously per request (spec §36, §82 rule 8).
3. `apps/worker` (its own `docker-compose.yml` service) drains the queue
   and calls `aggregateViewEventsBatch` (`packages/analytics`), which runs
   each event through `qualifyView` (`packages/revenue`) and upserts daily
   `ContentView` counters.
4. At period close, an admin/cron job (not built) reads `ContentView`
   totals, calls `splitRevenuePool` + `allocateCreatorPool`
   (`packages/revenue`) using the current `RevenueConfig`, and writes
   `RevenueTransaction` + `WalletTransaction` rows via `WalletLedger`.
5. The creator's `/dashboard/wallet` and `/dashboard/revenue` pages show the
   resulting available/pending/paid balances — always from the ledger, never
   from a mutable "balance" field treated as the source of truth.

## Admin surface

`apps/api/src/routes/admin.ts` and `apps/web/src/app/admin/**` implement
spec §40/§75's Admin dashboard: Users, Stories (any status, any creator),
Reports, Revenue configuration, Payouts, and SEO Health. It's a third route
tree alongside the public reader and the creator dashboard — client-
rendered like `/dashboard`, RBAC-gated both in the browser (for UX — a
non-admin sees a message, not a broken page) and, the part that actually
matters, on every API call (`app.requireRole(request, "MODERATOR" |
"ADMIN")`).

Every state-changing admin action goes through one of two existing,
already-audited code paths rather than a bespoke "just update the row":

- **Content/user moderation** (publish/unpublish/delete/restore/noindex a
  story; suspend/reactivate a user) → `packages/moderation`'s
  `applyModerationAction`, which always writes a `moderation_actions` row
  in the same transaction as the effect (spec §40's "every financial/
  moderation adjustment must have an audit log").
- **Anything touching a wallet** (marking a payout PAID/REVERSED, or a
  manual "adjust revenue" correction) → `packages/revenue`'s
  `WalletLedger.appendEntry`, which always writes an immutable
  `wallet_transactions` row before the wallet's cached balance changes.
  Marking a payout PAID is refused with `409` if the creator's available
  balance can't cover it — the admin UI can't accidentally pay out more
  than a creator has earned.

Revenue configuration (`revenue_configs`) is admin-creatable through this
surface too: `POST /admin/revenue-configs` validates the three percentages
sum to exactly 100 and auto-increments `version` — there's still no way to
edit a percentage in place, only add a new version (spec §72).

`GET /admin/seo-health` is a real implementation of spec §75's SEO Health
page: counts of published stories missing a description/cover, currently
noindexed, with a duplicate slug (should always be 0 — the schema's unique
constraint makes this a should-never-happen check, not a real risk), or
published with no published chapter yet (thin content).

Not built as part of the admin surface: a `Views`/`Payouts` deep-dive
beyond what's listed above, and no server-rendered "broken links" or
"broken canonical" crawl (spec §75 also lists these; they'd need an actual
crawl of the public site, which is a bigger piece of infrastructure than
the rest of this table's gaps).

## Implementation status

Everything above the "Deliberately out of scope" line in the README is
implemented and has passing tests against a real Postgres. Explicitly not
built in this pass, and why:

| Not built | Why it's safe to defer | What exists instead |
|---|---|---|
| Revenue period lifecycle automation (OPEN→CALCULATING→FRAUD_REVIEW→FINALIZED→PAYOUT_AVAILABLE) | The `RevenuePool.status` enum and the calculation functions exist; the state machine that walks a period through these stages on a schedule doesn't. | `splitRevenuePool`/`allocateCreatorPool`/`WalletLedger` (`packages/revenue`). |
| Fraud/bot detection beyond view-qualification thresholds | Out of scope for an MVP; the qualification pipeline has the seam (`RawViewEvent.isSuspectedBot`) for a real detector to plug into. | `qualifyView` treats every non-bot-flagged session as valid/qualified per duration+scroll thresholds. |
| A real `PaymentProvider` (bank transfer/Stripe/etc.) | The interface is the point — swapping providers shouldn't touch calling code. | `ManualPaymentProvider` (records payouts as pending for back-office processing). |
| OpenSearch `SearchProvider` | `PostgresSearchProvider` is the MVP implementation the spec calls for; the interface (`packages/search`) is what a second implementation would satisfy. | `PostgresSearchProvider`. |
| 410 Gone distinction in `apps/web` pages | `apps/api`'s public routes correctly return 410 for soft-deleted content vs. 404 for never-existed (tested). Server Components can only call `notFound()` (always 404) without middleware; that middleware wasn't built this pass — a content lookup on every request would also cost TTFB at scale, so it's deferred until real traffic justifies it. | API-level 404/410 tests. |
