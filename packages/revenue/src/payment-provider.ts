/**
 * PaymentProvider abstraction (spec #1, #74) — not locked to a specific
 * provider (bank transfer, PayPal, Stripe Connect, MoMo, etc). The payout
 * worker depends on this interface only.
 */
export interface PayoutRequest {
  payoutId: string;
  creatorId: string;
  amountCents: bigint;
  currency: string;
  accountDetails: Record<string, unknown>;
}

export interface PayoutExecutionResult {
  success: boolean;
  providerReference?: string;
  failureReason?: string;
}

export interface PaymentProvider {
  name: string;
  executePayout(request: PayoutRequest): Promise<PayoutExecutionResult>;
}

/** Default MVP provider: records the payout as PENDING for manual/back-office processing. No real money moves. */
export class ManualPaymentProvider implements PaymentProvider {
  name = "manual";

  async executePayout(request: PayoutRequest): Promise<PayoutExecutionResult> {
    return { success: true, providerReference: `manual-${request.payoutId}` };
  }
}

export function isPayoutEligible(availableBalanceCents: bigint, minimumThresholdCents: bigint): boolean {
  return availableBalanceCents >= minimumThresholdCents;
}
