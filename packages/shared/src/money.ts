/** All monetary amounts are stored as integer cents (BigInt) with an explicit currency. */
export interface Money {
  amountCents: bigint;
  currency: string;
}

export function formatMoney({ amountCents, currency }: Money, locale = "vi-VN"): string {
  const major = Number(amountCents) / 100;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(major);
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add mismatched currencies: ${a.currency} vs ${b.currency}`);
  }
  return { amountCents: a.amountCents + b.amountCents, currency: a.currency };
}

/**
 * Splits an amount into shares by percentage without losing cents to rounding:
 * every share is floored, and the leftover remainder cents go to the largest
 * share (deterministic, so re-running the calculation is stable).
 */
export function splitByPercentage(amountCents: bigint, shares: { key: string; percentage: number }[]): Map<string, bigint> {
  const totalPercentage = shares.reduce((sum, s) => sum + s.percentage, 0);
  if (totalPercentage <= 0) throw new Error("Total percentage must be > 0");

  const raw = shares.map((s) => ({
    key: s.key,
    exact: (amountCents * BigInt(Math.round(s.percentage * 100))) / BigInt(Math.round(totalPercentage * 100)),
  }));

  const result = new Map<string, bigint>();
  let allocated = 0n;
  for (const r of raw) {
    result.set(r.key, r.exact);
    allocated += r.exact;
  }

  const remainder = amountCents - allocated;
  if (remainder !== 0n && raw.length > 0) {
    const largest = [...raw].sort((a, b) => (b.exact > a.exact ? 1 : -1))[0]!;
    result.set(largest.key, (result.get(largest.key) ?? 0n) + remainder);
  }

  return result;
}
