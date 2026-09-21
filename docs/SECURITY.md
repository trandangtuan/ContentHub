# Security

## Authentication

Passwords are hashed with Node's built-in `scrypt` (`packages/auth/src/
password.ts`) — a random 16-byte salt per password, a 64-byte derived key,
stored as `scrypt:<salt>:<hash>`. Verification uses
`crypto.timingSafeEqual`, not `===`, to avoid a timing side-channel.
Minimum password length is 8 characters, enforced before hashing
(`WeakPasswordError` → `422`).

Sessions are opaque, cryptographically random tokens
(`packages/auth/src/session.ts`, 32 bytes via `crypto.randomBytes`) issued
as an `httpOnly`, `sameSite=lax` cookie. Only the **SHA-256 hash** of the
token is ever persisted (`sessions.token_hash`) — a database read (or
backup, or replication stream) never exposes a usable session token.
Sessions carry an `expires_at` and a `revoked_at` (set on logout); both are
checked on every request, along with the owning user's `status ===
"ACTIVE"` (a suspended/banned user's existing sessions stop working
immediately, not just future logins).

A JWT path (`packages/auth/src/jwt.ts`) exists for non-cookie clients
(mobile apps, third-party integrations — spec §61) — short-lived, HS256,
issuer-checked, never the primary web auth mechanism.

## CSRF

Double-submit token (`packages/auth/src/csrf.ts`): `GET /auth/session`
returns a token HMAC'd from the session token + a random nonce
(`issueCsrfToken`), using a server secret (`SESSION_SECRET`) the client
never sees. Every mutating `apps/api` route calls `app.requireCsrf(request)`,
which recomputes the HMAC from the `x-csrf-token` header + the caller's
actual session cookie and compares with `timingSafeEqual`. A token issued
for one session can't be replayed against another (tested); a tampered
token fails (tested).

## RBAC

`packages/auth/src/rbac.ts`'s `hasRole`/`isOwnerOrRole` are simple rank
comparisons (`READER < CREATOR < MODERATOR < ADMIN`) — but the point isn't
the comparison, it's that every mutating route calls
`app.requireRole`/`app.requireAuth` and, for anything scoped to a specific
story/chapter, an explicit `requireOwnedStory` check
(`apps/api/src/routes/creator.ts`) that loads the resource and compares
`creator_id` against the caller's own `creator_profile_id` before any
write. A client can never publish, edit, or delete a story it doesn't own
by guessing another creator's story ID — this is tested
(`creator.test.ts`, "forbids a different creator from editing someone
else's story").

## XSS / HTML sanitization

Chapter/story body HTML is stored as the creator wrote it (via TipTap) but
is **never** rendered with `dangerouslySetInnerHTML` without passing
through `apps/web/src/lib/sanitize.ts`'s `sanitizeContentHtml` first
(DOMPurify, via `isomorphic-dompurify`) — an explicit tag/attribute
allowlist (`p`, headings, `blockquote`, lists, `a`, `img`, `hr`, `br`;
`href`/`src`/`alt`/`title`/`rel`/`target` attributes only). This runs both
on the public reader page and on the dashboard's own chapter preview — a
creator's own draft isn't exempted, since the editor's output shouldn't be
trusted more than any other HTML string.

## SQL injection

All database access goes through Prisma's query builder or tagged-template
`$queryRaw`/`$transaction` (parameterized — see `packages/search`'s
`PostgresSearchProvider`, which uses `$queryRaw` with the search term as a
template parameter, never string concatenation). No raw string-built SQL
exists anywhere in the codebase.

## Rate limiting

`@fastify/rate-limit`, global (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`, env-
configured, default 100/min) plus a tighter per-route limit on
`POST /events/view` (60/min) since that endpoint is unauthenticated and
otherwise the cheapest to spam.

## Upload validation

`packages/storage/src/validation.ts`: per-purpose (`cover`/`avatar`/
`chapter-image`) MIME allowlists and size limits, checked *before* any
upload proceeds (`InvalidUploadError`). Object keys are generated from the
upload's **context slug** (the story/user slug), never the client-supplied
filename (`buildSafeObjectKey`) — `IMG_12345.jpg` becomes
`cover/tu-tien-1000-nam-cover-a1b2c3d4.webp`, which is both a path-
traversal-safe key and a semantically useful filename (spec §20).

## Privacy: IP / session hashing

`packages/auth/src/privacy.ts`'s `hashIp` (SHA-256, keyed with a server
secret) is used everywhere a raw IP or session identifier would otherwise
be persisted: `sessions.ip_hash`, and the analytics event pipeline
(`packages/analytics/src/queue.ts`) hashes both the client's `sessionId`
and the request IP before they ever reach a queue job or the database
(spec §37, §82 rule 8). No code path stores a raw IP.

## Input validation

Every `apps/api` route parses its body/params/query with a `zod` schema
before touching the database (`z.object({...}).parse(...)`) — a malformed
request fails with `422` and a structured error before any handler logic
runs, rather than reaching Prisma with the wrong shape.

## What's not built (be aware of this before deploying)

- **Encryption at rest for `payout_accounts.account_details`.** The column
  is `Json` and provider-agnostic by design (docs/DATABASE.md), but nothing
  in this pass encrypts it — a production deployment handling real payout
  details should add application-level field encryption before storing
  bank/PayPal details there.
- **A real virus/malware scan on uploads.** MIME/size validation exists;
  content inspection (e.g. verifying an "image/jpeg" upload is actually a
  valid JPEG, not a renamed executable) does not.
- **Stripped EXIF/metadata on uploaded images** (spec §60's "strip
  dangerous metadata when appropriate") — not implemented in this pass.
- **A CSP header** — not configured on either app in this pass.
