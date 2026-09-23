# Database

PostgreSQL 16, managed by Prisma (`packages/database/prisma/schema.prisma`).
Every table has `id` (UUID, `gen_random_uuid()`), `created_at`, `updated_at`;
tables holding content or money-adjacent state also have `deleted_at`
(soft delete — see "Soft delete policy" below). Migrations live in
`packages/database/prisma/migrations/`.

## ERD (core tables)

```
users ──1:1── creator_profiles ──1:n── contents
  │                  │                    │
  │                  │                    ├─1:n─ content_parts ──1:n─ content_versions
  │                  │                    ├─n:n─ content_categories ─ categories
  │                  │                    ├─n:n─ content_tags ─ tags
  │                  │                    ├─1:1─ seo_metadata
  │                  │                    ├─1:n─ redirects
  │                  │                    ├─1:n─ content_events (raw)
  │                  │                    ├─1:n─ content_views (daily aggregate)
  │                  │                    ├─1:n─ likes, comments
  │                  │                    └─1:n─ creator_revenue
  │                  ├─1:1─ wallets ──1:n── wallet_transactions
  │                  ├─1:n─ payout_accounts ──1:n── payouts
  │                  └─1:n─ follows (as target)
  └─1:n─ sessions, follows (as user), likes, comments, moderation_reports/actions

revenue_configs (versioned) ──1:n── revenue_pools ──1:n── creator_revenue
                                          └─1:n── revenue_transactions

moderation_reports ──1:n── moderation_actions
```

## Table notes

### `users` / `creator_profiles`
`users.role` (READER/CREATOR/MODERATOR/ADMIN) is the RBAC source of truth,
checked server-side on every mutating request — never trust a client-sent
role. `creator_profiles` is a separate 1:1 table rather than fields on
`users` so "does this user have a public creator page" is a clean existence
check, and so an `Organization`-type creator (`is_organization`) doesn't
need a second user-like concept.

### `contents` / `content_parts` / `content_versions`
See docs/ARCHITECTURE.md for why `contents` is the polymorphic core, and
for how `content_parts` (not a per-`ContentType` table) holds every type's
body. `contents.attributes` (`jsonb`) holds type-specific scalar metadata
(e.g. a story's `{subtitle, ageRating}`) — a new `ContentType` with only
scalar fields needs no new table. `content_parts.slug` is unique per
`(content_id, slug)`, not globally — two different stories can both have a
`chuong-1` (a "single" `partsMode` type's one part always uses the fixed
slug `"content"`, never rendered in a URL). `content_versions` is an
append-only revision log: every save (including a part's first save)
writes one row, `created_by_id` records who. `contents.search_vector` is a
generated/trigger-maintained `tsvector` (migration
`20260921063600_search_vector_trigger`) — see docs/SEO.md's search
section.

### `categories` / `tags` / `content_categories` / `content_tags`
Plain many-to-many join tables. A tag only gets an indexable landing page
once it has ≥2 published stories (enforced in `apps/web`'s
`TagSitemapProvider` and the tag page's `generateMetadata`, not in the
schema — the schema just counts).

### `follows` / `likes` / `comments`
`comments.parent_id` self-references for nested replies; `depth` is
denormalized so the API can cheaply reject replies past a configured
max depth without recursive queries.

### `content_events` / `content_views`
Two different tables on purpose. `content_events` is the raw, short-
retention log the event-ingestion endpoint writes to (via a queue, not
synchronously) — `session_id_hash` and `ip_hash` are one-way hashes, never
the raw values (spec §37, §82 rule 8). `content_views` is the daily
aggregate (`raw_views`/`valid_views`/`qualified_views`/`monetized_views`
per `content_id` + `content_part_id` + `date`) that analytics and revenue
calculations actually read — nothing downstream of ingestion ever
re-scans `content_events`.

### `revenue_configs` / `revenue_pools` / `creator_revenue` / `revenue_transactions`
`revenue_configs` is versioned (`version` unique, `effective_from`) so a
percentage change is auditable and never a silent code edit (spec §72).
`revenue_pools` is one row per `YYYY-MM` period, referencing the
`revenue_config` that applied to it. `revenue_transactions` is an
immutable audit trail of money entering/leaving a pool; `creator_revenue`
is the computed per-creator allocation for a period.

### `wallets` / `wallet_transactions`
`wallets.balance_*` columns are a **cache**, recomputed by
`WalletLedger` (`packages/revenue`) from `wallet_transactions`, which is
the actual source of truth (spec §38, §82 rule "creator.balance = X is
never the only source"). Never write to `wallets.balance_*` outside the
ledger.

### `payout_accounts` / `payouts`
`payout_accounts.account_details` is `Json` — provider-specific (bank
details, PayPal email, ...) and deliberately opaque to the schema so
adding a payment provider never requires a migration. In production this
column should be encrypted at rest (see docs/SECURITY.md).

### `moderation_reports` / `moderation_actions`
Reports move `OPEN → REVIEWING → RESOLVED|REJECTED` (enforced in
`packages/moderation`, not by a DB constraint — Postgres enums don't
express state-machine transitions). Every `moderation_actions` row is
written *before* its effect is applied, inside the same transaction (spec
§40).

### `seo_metadata` / `redirects`
`seo_metadata.ai_summary_origin` (CREATOR/AI_GENERATED/SYSTEM_GENERATED)
exists so an AI-written summary is never presented as if the creator wrote
it (spec §24, §58). `redirects.from_path` is unique; a slug rename writes
one of these rows before the slug itself changes (spec §31) — see
`packages/seo`'s `buildSlugChangeRedirect` and `apps/api`'s story-rename
handler.

## Soft delete policy

`deleted_at` exists on: `users`, `creator_profiles`, `contents`,
`content_parts`, `categories`, `tags`, `comments`, `payout_accounts`.
Nothing user-generated is ever hard-deleted from these tables (spec §3) —
a "delete" moderation action sets `deleted_at` and moves `contents.status`
to `ARCHIVED`; public queries filter `deleted_at: null` explicitly (see
`apps/api/src/routes/public.ts`, `apps/web/src/lib/public-data.ts`).
Tables that are pure event/ledger logs (`content_events`, `content_views`,
`wallet_transactions`, `revenue_transactions`, `moderation_actions`,
`sessions`) have no `deleted_at` — they're either already immutable by
design or short-retention by nature.

## Indexes

Declared in `prisma/schema.prisma`, chosen for the query patterns the API
and web app actually run (spec §54) — not "index every column":

| Table | Index | Query it serves |
|---|---|---|
| `contents` | `slug` (unique) | canonical URL lookup (`/truyen/[slug]`) |
| `contents` | `creator_id` | "this creator's stories" (dashboard, author page) |
| `contents` | `status`, `(status, visibility, published_at)` | public listing filters |
| `contents` | `published_at` | "latest stories" ordering |
| `contents` | `search_vector` (GIN) | full-text search |
| `content_parts` | `(content_id, slug)` (unique) | chapter URL lookup |
| `content_parts` | `content_id`, `(content_id, position)` | chapter list / prev-next nav |
| `content_views` | `content_id`, `(content_id, date)` | analytics/revenue rollups |
| `follows` | `user_id`, `creator_id` | "am I following", follower counts |
| `wallet_transactions` | `(wallet_id, created_at)` | ledger history, newest-first |
| `sessions` | `token_hash` (unique) | session lookup on every request |

## Language / locale

`contents.language` and `users.locale` are free-text (default `"vi"`), not
a hard-coded enum of Vietnamese-only values (spec §56) — the frontend's
locale switching (`vi`/`en`) is independent of what languages content can
be published in.
