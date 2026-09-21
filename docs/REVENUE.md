# Revenue

## The view qualification pipeline

```
RAW VIEW → VALID VIEW → QUALIFIED VIEW → MONETIZED VIEW
```

Implemented in `packages/revenue/src/view-qualification.ts`. Every
ingested event starts `RAW`. `qualifyView(event)` advances it one stage at
a time — a view cannot skip straight to `MONETIZED`:

1. **RAW → nothing further** if `event.isSuspectedBot`, or if
   `durationSec < minValidDurationSec` (default 3s).
2. **→ VALID** once duration clears that floor.
3. **→ QUALIFIED** once `durationSec >= minQualifiedDurationSec` (default
   20s) **and** `scrollDepth >= minQualifiedScrollDepth` (default 0.3).
4. **→ MONETIZED** only if the content is monetization-eligible
   (`PUBLISHED` + `PUBLIC`) *and* the view is `QUALIFIED`.

This all runs **server-side**, in the aggregation worker
(`packages/analytics/src/aggregate.ts`), never trusting a client-reported
qualification (spec §82 rules 9–10) — the ingestion endpoint's zod schema
(`packages/analytics/src/event.ts`) doesn't even have a field for "is this
qualified," so there's no value to distrust in the first place.

`aggregateViewStages` rolls a batch of per-event stages into the four
counters (`rawViews`/`validViews`/`qualifiedViews`/`monetizedViews`) that
get upserted into `content_views` (one row per content/chapter/day) — this
table, not the raw `content_events` log, is what every downstream
calculation reads.

## Why not "1 view = X đồng"

Spec §35 explicitly forbids a flat per-view rate. Instead:

```
Monthly ad/subscription revenue
        ↓
RevenuePool (one row per YYYY-MM)
        ↓  splitRevenuePool()  — creator_pool_percentage / platform_percentage / fraud_reserve_percentage
Creator Pool
        ↓  allocateCreatorPool()  — proportional to each creator's qualified views
Per-creator CreatorRevenue row
```

Both split functions live in `packages/revenue/src/allocation.ts`.
`splitRevenuePool` and the proportional split inside `allocateCreatorPool`
both go through `packages/shared`'s `splitByPercentage`, which floors every
share to whole cents and assigns the leftover remainder to the largest
share — so the parts always sum to exactly the input amount (verified for
values up to 10^12 cents in `packages/shared/src/money.test.ts`), instead
of silently losing or fabricating a cent to rounding.

The percentages themselves come from `revenue_configs`, a **versioned**
table (`version` unique, `effective_from`) — never a hard-coded constant in
source (spec §72, §82 rule 11). `.env.example`'s
`REVENUE_DEFAULT_*_PERCENTAGE` values only seed the *first* config row;
changing the split later means inserting a new `revenue_configs` row, which
is itself an audit trail of every rate change.

## The ledger

`packages/revenue/src/ledger.ts`'s `WalletLedger` is the only code path
allowed to change a wallet's balance. `appendEntry` runs inside a Postgres
transaction: it reads the wallet (creating one if needed), computes the new
`available`/`pending`/`paid` totals based on the transaction `type`
(`VIEW_REVENUE`/`AD_REVENUE` credit `pending`; everything else credits/
debits `available`; `PAYOUT` also increments `paid`), writes one
`wallet_transactions` row recording `balance_after_cents`, and only then
updates `wallets.balance_*`. Those `wallets` columns are a **cache** —
`wallet_transactions` is the real ledger (spec §38, §82: "creator.balance =
1000000" must never be the only source of truth), and in principle the
cache can always be rebuilt by summing the ledger.

`releasePendingToAvailable` moves a period's `VIEW_REVENUE`/`AD_REVENUE`
from `pending` to `available` once that period is `FINALIZED` — the
distinction reflects the dashboard's requirement to show *estimated/
pending* separately from *available* (spec §39, §71): a number in `pending`
can still move due to a fraud adjustment before it's `FINALIZED`, so it's
never presented as guaranteed.

## Payouts

`packages/revenue/src/payment-provider.ts` defines `PaymentProvider`
(`executePayout(request) → { success, providerReference?, failureReason?
}`) — swapping bank transfer / Stripe Connect / PayPal / MoMo for the
payout rail is implementing this interface, not touching the payout
workflow. `ManualPaymentProvider` is the MVP implementation: it marks a
payout as accepted for back-office/manual processing rather than moving
real money.

`isPayoutEligible(availableCents, minimumThresholdCents)` is the minimum-
payout-threshold check (spec §74) — the threshold itself comes from
`revenue_configs.minimum_payout_threshold_cents`
(`.env.example`'s `REVENUE_MINIMUM_PAYOUT_THRESHOLD_CENTS` only seeds the
first row), never hard-coded.

## Revenue period lifecycle

`revenue_pools.status`: `OPEN → CALCULATING → FRAUD_REVIEW → FINALIZED →
PAYOUT_AVAILABLE` (spec §73). The enum and the pool/allocation-writing
functions exist and are tested; the scheduler that actually walks a period
through these states at month-end is not built in this pass — see
docs/ARCHITECTURE.md's implementation-status table.

## Dashboard transparency

`/dashboard/revenue` and `/dashboard/wallet` (`apps/web`) never show a bare
number. They break it down into raw/qualified/monetized views per story
(`GET /creator/analytics`) and available/pending/paid wallet balances with
a plain-language explanation of where each figure comes from
(`GET /creator/wallet`) — matching spec §71's requirement that revenue be
explained, not just displayed.

## What server-side means here, concretely

Every number that ends up affecting money is computed in `apps/api` or a
worker, from data the client cannot set directly:

- Word count / reading time: computed from `bodyHtml` server-side on every
  chapter save (`apps/api/src/routes/creator.ts`), not accepted as a field
  from the client.
- View qualification stage: computed by the aggregation worker from raw
  `durationSec`/`scrollDepth`/bot-flag, never accepted from the client.
- Revenue split percentages: read from `revenue_configs`, never a request
  body field.
- Wallet balances: only ever written by `WalletLedger`, inside a DB
  transaction.
