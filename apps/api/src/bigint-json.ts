/**
 * Fastify's default JSON serializer (used for any route without an
 * explicit response schema — every route in this API) calls
 * `JSON.stringify`, which throws `TypeError: Do not know how to serialize
 * a BigInt`. Prisma returns `BigInt` for every money/threshold column
 * (amount_cents, minimum_payout_threshold_cents, balance_after_cents, ...),
 * so teach `JSON.stringify` how to serialize it — via the standard
 * `toJSON` hook it already checks for — instead of hand-converting every
 * field in every response. Imported once, as a side effect, before the app
 * is built.
 */
if (typeof (BigInt.prototype as unknown as { toJSON?: unknown }).toJSON !== "function") {
  Object.defineProperty(BigInt.prototype, "toJSON", {
    value(this: bigint) {
      return this.toString();
    },
  });
}
