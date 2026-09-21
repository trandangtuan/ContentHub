import type { PrismaClient, WalletTransactionType } from "@contenthub/database";

export interface AppendLedgerEntryParams {
  creatorId: string;
  type: WalletTransactionType;
  amountCents: bigint; // positive credits the wallet, negative debits it (e.g. PAYOUT)
  currency: string;
  description?: string;
  relatedPayoutId?: string;
}

/**
 * Wallet balances are never written directly (spec #38, #82 rule "creator.balance
 * = 1000000 is never the source of truth"). Every credit/debit goes through
 * this ledger, inside a transaction, so wallet_transactions.balance_after_cents
 * is always consistent with the running total.
 */
export class WalletLedger {
  constructor(private readonly db: PrismaClient) {}

  async appendEntry(params: AppendLedgerEntryParams) {
    return this.db.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { creatorId: params.creatorId },
        update: {},
        create: { creatorId: params.creatorId, currency: params.currency },
      });

      const isPending = params.type === "VIEW_REVENUE" || params.type === "AD_REVENUE";
      const newAvailable = wallet.balanceAvailableCents + (isPending ? 0n : params.amountCents);
      const newPending = wallet.balancePendingCents + (isPending ? params.amountCents : 0n);
      const newPaid = wallet.balancePaidCents + (params.type === "PAYOUT" ? -params.amountCents : 0n);

      const balanceAfterCents = newAvailable + newPending;

      const entry = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: params.type,
          amountCents: params.amountCents,
          currency: params.currency,
          balanceAfterCents,
          relatedPayoutId: params.relatedPayoutId,
          description: params.description,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceAvailableCents: newAvailable,
          balancePendingCents: newPending,
          balancePaidCents: newPaid,
        },
      });

      return entry;
    });
  }

  /** Moves a pending balance (VIEW_REVENUE/AD_REVENUE) to available, e.g. once a period is FINALIZED. */
  async releasePendingToAvailable(creatorId: string, amountCents: bigint) {
    return this.db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { creatorId } });
      if (wallet.balancePendingCents < amountCents) {
        throw new Error(`Cannot release ${amountCents} cents: only ${wallet.balancePendingCents} pending.`);
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePendingCents: wallet.balancePendingCents - amountCents,
          balanceAvailableCents: wallet.balanceAvailableCents + amountCents,
        },
      });
    });
  }
}
