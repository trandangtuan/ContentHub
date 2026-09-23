# API

Base URL: `${API_URL}/api/v1` (`http://localhost:4000/api/v1` in dev). All
request/response bodies are JSON. Auth is a session cookie
(`ch_session`, httpOnly) issued by `/auth/login`/`/auth/register`; every
mutating request additionally requires an `x-csrf-token` header (see
docs/SECURITY.md).

This document describes what's implemented; `apps/api/src/routes/*.test.ts`
is the executable version of it.

## Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | `{ email, password (≥8 chars), displayName }`. Sets the session cookie. 409 on duplicate email, 422 on weak password. |
| POST | `/auth/login` | — | `{ email, password }`. 401 on bad credentials or non-ACTIVE account. |
| POST | `/auth/logout` | session | Revokes the session, clears the cookie. |
| GET | `/auth/session` | — | `{ authenticated: false }` or `{ authenticated: true, userId, role, creatorProfileId, csrfToken }`. The dashboard fetches this once to get its CSRF token. |

## Creator (all require a session; most require the `CREATOR` role and/or resource ownership)

Per-`ContentType` routes (stories, articles, and their chapters) are
registered generically from `packages/seo`'s content-type registry
(`apps/api/src/routes/content.ts`'s `registerContentTypeRoutes`) — one
function call per registry entry, not one route file per type. The table
below shows `:apiResource` (`stories` for STORY, `articles` for ARTICLE
today) and, for a "multi" `partsMode` type only, `:partsApiResource`
(`chapters` for STORY — ARTICLE has none, since it's "single": exactly one
part, created with its Content).

| Method | Path | Notes |
|---|---|---|
| POST | `/creator/profile` | Becomes a Creator: creates `creator_profiles` + `wallets` rows, promotes `users.role` to `CREATOR`. 409 if already a creator. |
| GET | `/creator/me` | The caller's own creator profile. |
| GET | `/creator/:apiResource` | The caller's own items of that type, any status (dashboard list view). A "single" type's items include their one `parts[0]`. |
| GET | `/creator/:apiResource/:id` | One of the caller's own items (any status) — 403 if owned by someone else, 404 if the id belongs to a different `ContentType`. |
| POST | `/creator/:apiResource` | Create a `DRAFT`/`PRIVATE` item. `{ title, description?, shortDescription?, coverImage?, language?, categoryIds?, attributes? }` — `attributes` is the type's scalar metadata (e.g. STORY's `{subtitle, ageRating}`). A "single" type also accepts `bodyHtml`/`bodyJson` here, creating its one part in the same call. |
| PATCH | `/creator/:apiResource/:id` | Update fields; a `title` change generates a new slug and writes a 301 `redirects` row for the old path. A "single" type's `bodyHtml` update also appends a `content_versions` row. |
| POST | `/creator/:apiResource/:id/publish` | 422 if required fields are missing (`title`+`description` for "multi"; `title`+body for "single"); otherwise sets `PUBLISHED`/`PUBLIC` (and, for "single", its one part to `PUBLISHED` too). |
| POST | `/creator/:apiResource/:id/unpublish` | Sets `UNPUBLISHED`. |
| DELETE | `/creator/:apiResource/:id` | Soft delete (`deleted_at` + `UNPUBLISHED`). |
| GET | `/creator/:apiResource/:id/:partsApiResource` | "multi" only: all chapters of the item (any status). |
| POST | `/creator/:apiResource/:id/:partsApiResource` | "multi" only: create a chapter. `{ title, bodyHtml, bodyJson? }`. Word count/reading time computed server-side; also seeds `content_versions` revision 1. |
| GET | `/creator/:partsApiResource/:id` | "multi" only: one chapter. |
| PATCH | `/creator/:partsApiResource/:id` | "multi" only: update title/body. Every `bodyHtml` change appends a new `content_versions` row (autosave history). |
| POST | `/creator/:partsApiResource/:id/publish` | "multi" only: `{ scheduledAt? }`. Without `scheduledAt`: publishes immediately. With it: sets `SCHEDULED` (a worker to flip it to `PUBLISHED` at the target time is not built — see docs/ARCHITECTURE.md). |
| POST \| DELETE | `/creator/:partsApiResource/:id/unpublish` \| `/creator/:partsApiResource/:id` | "multi" only: unpublish, or soft-delete the chapter. |
| GET | `/creator/analytics` | Follower count + per-item (any type) raw/qualified/monetized view totals. |
| GET | `/creator/wallet` | `{ availableCents, pendingCents, paidCents, currency, transactions[] }` — never a bare balance (spec §71). |

Ownership is enforced on every mutation: the resource's `creator_id` must
match the caller's `creator_profile_id`, unless the caller is `MODERATOR`/
`ADMIN` — a non-owner gets `403`, never a silent no-op or 404-that's-really-
a-permission-error.

## Public (no auth; only `PUBLISHED` + `PUBLIC` + non-deleted content is ever returned)

Also generic, from `apps/api/src/routes/public.ts`'s
`registerPublicContentTypeRoutes` (one call per content-type registry entry).

| Method | Path | Notes |
|---|---|---|
| GET | `/public/:apiResource` | `?limit&offset&category&tag`. |
| GET | `/public/:apiResource/:slug` | Full item detail — a "multi" type includes its published chapter list (`chapters`), a "single" type includes its one part flattened into `bodyHtml`/`wordCount`/`readingTimeMinutes`. 404 if missing/unpublished/private, 410 if soft-deleted. |
| GET | `/public/:apiResource/:slug/:partsApiResource` | "multi" only: published chapters only. |
| GET | `/public/:apiResource/:itemSlug/:partsApiResource/:partSlug` | "multi" only: chapter body + item/author context + prev/next chapter. 404/410 per the same rule as the item endpoint. |
| GET | `/public/authors/:slug` | Author profile + all of their published items, any type. |
| GET | `/public/categories/:slug` | `?limit&offset`. |
| GET | `/public/tags/:slug` | Includes `isIndexable` (≥2 items) so a client can decide whether to render it as an SEO landing page. |
| GET | `/public/search` | `?q&limit` — Postgres full-text search (`packages/search`). |

Every public response is built by `apps/api/src/serializers.ts`'s
`serializePublicContent` — the one place that guarantees `email`, wallet/
revenue fields, and moderation data are never present in a public response
(spec §25, §82 rule 7), independent of whatever gets added to the Prisma
`include` for some other reason later.

Crawlers do **not** need this API to read content — the HTML pages
(`apps/web`) are fully server-rendered independently. This API exists for
the dashboard, and for any future mobile app / third-party integration
(spec §62).

## Events

| Method | Path | Notes |
|---|---|---|
| POST | `/events/view` | `{ contentId, contentPartId?, sessionId, event: "CONTENT_VIEW", timestamp, duration?, scrollDepth? }`. Returns `202 Accepted` immediately; the event is enqueued (BullMQ), never written synchronously. Rate-limited to 60/min per caller. |

The schema has no field for a client to claim a view is "qualified" or
"monetized" — see docs/REVENUE.md.

## Admin (requires `MODERATOR` or `ADMIN`; some routes are `ADMIN`-only as noted)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/admin/stats` | MODERATOR | Overview counts: users, creators, stories, chapters, open reports, pending payouts. |
| GET | `/admin/users` | MODERATOR | `?status&role&q&limit&offset`. |
| POST | `/admin/users/:id/suspend` | **ADMIN** | `{ reason }`. |
| POST | `/admin/users/:id/reactivate` | **ADMIN** | Sets the user back to `ACTIVE`. |
| GET | `/admin/stories` | MODERATOR | Cross-creator, any status. `?status&creatorId&q&limit&offset`. |
| GET | `/admin/stories/:id/chapters` | MODERATOR | Any status. |
| POST | `/admin/stories/:id/{publish\|unpublish\|delete\|restore\|noindex}` | MODERATOR | `{ reason? }`. `delete` is a soft delete (spec §3). |
| GET | `/admin/reports` | MODERATOR | `?status&limit&offset`. |
| POST | `/admin/reports` | MODERATOR | File a report on a user's behalf: `{ targetType, targetId, reason, details? }`. |
| POST | `/admin/reports/:id/review` | MODERATOR | `OPEN → REVIEWING`. |
| POST | `/admin/reports/:id/reject` | MODERATOR | `OPEN\|REVIEWING → REJECTED`. |
| POST | `/admin/reports/:id/action` | MODERATOR (**ADMIN** if `action` is `SUSPEND_CREATOR`/`REACTIVATE_USER`) | `{ targetType, targetId, action, reason? }` — applies a moderation action and resolves the report in one call. |
| GET | `/admin/revenue-configs` | MODERATOR | All versions, newest first. |
| POST | `/admin/revenue-configs` | **ADMIN** | `{ creatorPoolPercentage, platformPercentage, fraudReservePercentage, minimumPayoutThresholdCents, currency, effectiveFrom }`. `422` unless the three percentages sum to exactly 100. Auto-increments `version`. |
| POST | `/admin/creators/:id/wallet/adjust` | **ADMIN** | `{ amountCents, description, currency? }` — `amountCents` may be negative. Always goes through `WalletLedger` (spec §40). |
| GET | `/admin/payouts` | MODERATOR | `?status&limit&offset`. |
| POST | `/admin/payouts/:id/status` | **ADMIN** | `{ status: PROCESSING\|PAID\|FAILED\|REVERSED, failureReason? }`. `PAID` is `409` if the creator's available wallet balance can't cover it; `REVERSED` is only valid from `PAID`. |
| GET | `/admin/seo-health` | MODERATOR | Counts: missing description/cover, noindexed, duplicate slugs, published-without-chapters. |

Every mutation here still goes through `applyModerationAction`
(`packages/moderation`) or `WalletLedger.appendEntry`
(`packages/revenue`) — there is no route in this section that writes to
`contents`/`users`/`wallets` without also writing the corresponding
`moderation_actions`/`wallet_transactions` audit row first, in the same
transaction. See docs/ARCHITECTURE.md's "Admin surface" section.

## Errors

Every error response is `{ error: "<CODE>", message: "<human text>" }`.
Status codes used: `401` (no/invalid session), `403` (authenticated but not
permitted — wrong owner, missing/invalid CSRF token, insufficient role),
`404` (never existed, or exists but not publicly visible), `409`
(conflict — duplicate email, duplicate redirect), `410` (permanently
removed — public item/part endpoints only), `422` (validation failure —
zod parse errors, or a business rule like "can't publish without a
description"), `429` (rate limited), `500` (unhandled).

## Versioning

Everything lives under `/api/v1`. A breaking change to a response shape
would get a `/api/v2` prefix rather than mutating `v1` in place — no v2
exists yet, so there's nothing to document beyond that policy.
