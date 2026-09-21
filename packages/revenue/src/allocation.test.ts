import { describe, expect, it } from "vitest";
import { splitRevenuePool, allocateCreatorPool } from "./allocation";

describe("splitRevenuePool", () => {
  it("splits the total using the configured percentages without losing cents", () => {
    const split = splitRevenuePool(1_000_000n, {
      creatorPoolPercentage: 70,
      platformPercentage: 25,
      fraudReservePercentage: 5,
    });
    expect(split.creatorPoolCents + split.platformCents + split.fraudReserveCents).toBe(1_000_000n);
    expect(split.creatorPoolCents).toBe(700_000n);
    expect(split.platformCents).toBe(250_000n);
    expect(split.fraudReserveCents).toBe(50_000n);
  });
});

describe("allocateCreatorPool", () => {
  it("distributes proportional to qualified views", () => {
    const allocations = allocateCreatorPool(1000n, [
      { creatorId: "a", qualifiedViews: 300 },
      { creatorId: "b", qualifiedViews: 700 },
    ]);
    const total = allocations.reduce((sum, a) => sum + a.amountCents, 0n);
    expect(total).toBe(1000n);
    expect(allocations.find((a) => a.creatorId === "a")!.amountCents).toBe(300n);
    expect(allocations.find((a) => a.creatorId === "b")!.amountCents).toBe(700n);
  });

  it("never pays a flat per-view rate — a creator with 0 qualified views gets 0", () => {
    const allocations = allocateCreatorPool(1000n, [
      { creatorId: "a", qualifiedViews: 0 },
      { creatorId: "b", qualifiedViews: 100 },
    ]);
    expect(allocations.find((a) => a.creatorId === "a")!.amountCents).toBe(0n);
  });

  it("returns all zeros when nobody has any qualified views", () => {
    const allocations = allocateCreatorPool(1000n, [
      { creatorId: "a", qualifiedViews: 0 },
      { creatorId: "b", qualifiedViews: 0 },
    ]);
    expect(allocations.every((a) => a.amountCents === 0n)).toBe(true);
  });
});
