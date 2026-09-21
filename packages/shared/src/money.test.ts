import { describe, expect, it } from "vitest";
import { splitByPercentage, addMoney } from "./money";

describe("splitByPercentage", () => {
  it("splits without losing cents to rounding", () => {
    const result = splitByPercentage(100n, [
      { key: "creator", percentage: 33.33 },
      { key: "platform", percentage: 33.33 },
      { key: "reserve", percentage: 33.34 },
    ]);
    const total = [...result.values()].reduce((a, b) => a + b, 0n);
    expect(total).toBe(100n);
  });

  it("gives the exact share for round percentages", () => {
    const result = splitByPercentage(10_000n, [
      { key: "creator", percentage: 70 },
      { key: "platform", percentage: 25 },
      { key: "reserve", percentage: 5 },
    ]);
    expect(result.get("creator")).toBe(7000n);
    expect(result.get("platform")).toBe(2500n);
    expect(result.get("reserve")).toBe(500n);
  });

  it("handles large amounts without overflow", () => {
    const result = splitByPercentage(1_000_000_000_000n, [
      { key: "creator", percentage: 70 },
      { key: "platform", percentage: 30 },
    ]);
    const total = [...result.values()].reduce((a, b) => a + b, 0n);
    expect(total).toBe(1_000_000_000_000n);
  });
});

describe("addMoney", () => {
  it("adds same-currency amounts", () => {
    expect(addMoney({ amountCents: 100n, currency: "VND" }, { amountCents: 200n, currency: "VND" })).toEqual({
      amountCents: 300n,
      currency: "VND",
    });
  });

  it("throws on mismatched currencies", () => {
    expect(() => addMoney({ amountCents: 100n, currency: "VND" }, { amountCents: 200n, currency: "USD" })).toThrow();
  });
});
