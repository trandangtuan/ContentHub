import { describe, expect, it } from "vitest";
import { ManualPaymentProvider, isPayoutEligible } from "./payment-provider";

describe("isPayoutEligible", () => {
  it("requires the configured minimum threshold, never hard-coded", () => {
    expect(isPayoutEligible(500_000n, 500_000n)).toBe(true);
    expect(isPayoutEligible(499_999n, 500_000n)).toBe(false);
  });
});

describe("ManualPaymentProvider", () => {
  it("records a successful manual payout with a traceable reference", async () => {
    const provider = new ManualPaymentProvider();
    const result = await provider.executePayout({
      payoutId: "payout-1",
      creatorId: "creator-1",
      amountCents: 500_000n,
      currency: "VND",
      accountDetails: {},
    });
    expect(result.success).toBe(true);
    expect(result.providerReference).toContain("payout-1");
  });
});
