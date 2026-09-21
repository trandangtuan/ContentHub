import { splitByPercentage } from "@contenthub/shared";

export interface RevenueSplitConfig {
  creatorPoolPercentage: number;
  platformPercentage: number;
  fraudReservePercentage: number;
}

export interface PoolSplit {
  creatorPoolCents: bigint;
  platformCents: bigint;
  fraudReserveCents: bigint;
}

/**
 * Splits a period's total revenue into the creator pool / platform / fraud
 * reserve, using the admin-configured (versioned) percentages — never
 * hard-coded (docs/REVENUE.md, spec #72).
 */
export function splitRevenuePool(totalAmountCents: bigint, config: RevenueSplitConfig): PoolSplit {
  const shares = splitByPercentage(totalAmountCents, [
    { key: "creator", percentage: config.creatorPoolPercentage },
    { key: "platform", percentage: config.platformPercentage },
    { key: "reserve", percentage: config.fraudReservePercentage },
  ]);

  return {
    creatorPoolCents: shares.get("creator") ?? 0n,
    platformCents: shares.get("platform") ?? 0n,
    fraudReserveCents: shares.get("reserve") ?? 0n,
  };
}

export interface CreatorQualifiedViews {
  creatorId: string;
  qualifiedViews: number;
}

export interface CreatorAllocation {
  creatorId: string;
  amountCents: bigint;
  sharePercentage: number;
}

/**
 * Distributes the creator pool across creators proportional to their
 * qualified views this period — never a flat "1 view = X đồng" rate
 * (docs/REVENUE.md, spec #35). A creator with 0 qualified views gets 0.
 */
export function allocateCreatorPool(creatorPoolCents: bigint, creators: CreatorQualifiedViews[]): CreatorAllocation[] {
  const totalViews = creators.reduce((sum, c) => sum + c.qualifiedViews, 0);
  if (totalViews === 0) {
    return creators.map((c) => ({ creatorId: c.creatorId, amountCents: 0n, sharePercentage: 0 }));
  }

  const shares = splitByPercentage(
    creatorPoolCents,
    creators.map((c) => ({ key: c.creatorId, percentage: (c.qualifiedViews / totalViews) * 100 })),
  );

  return creators.map((c) => ({
    creatorId: c.creatorId,
    amountCents: shares.get(c.creatorId) ?? 0n,
    sharePercentage: (c.qualifiedViews / totalViews) * 100,
  }));
}
