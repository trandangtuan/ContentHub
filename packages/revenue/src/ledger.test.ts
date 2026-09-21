import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@contenthub/database";
import { WalletLedger } from "./ledger";

const prisma = new PrismaClient();
const ledger = new WalletLedger(prisma);

let creatorId: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({
    data: { email: `ledger-test-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Ledger Test", role: "CREATOR" },
  });
  const creator = await prisma.creatorProfile.create({
    data: { userId: user.id, slug: `ledger-test-${suffix}`, displayName: "Ledger Test Creator" },
  });
  creatorId = creator.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("WalletLedger", () => {
  it("credits pending balance for VIEW_REVENUE and records balance_after_cents", async () => {
    const entry = await ledger.appendEntry({
      creatorId,
      type: "VIEW_REVENUE",
      amountCents: 10_000n,
      currency: "VND",
      description: "2026-09 qualified views",
    });
    expect(entry.balanceAfterCents).toBe(10_000n);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { creatorId } });
    expect(wallet.balancePendingCents).toBe(10_000n);
    expect(wallet.balanceAvailableCents).toBe(0n);
  });

  it("releases pending to available", async () => {
    await ledger.releasePendingToAvailable(creatorId, 10_000n);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { creatorId } });
    expect(wallet.balancePendingCents).toBe(0n);
    expect(wallet.balanceAvailableCents).toBe(10_000n);
  });

  it("debits available balance for PAYOUT and tracks paid total", async () => {
    await ledger.appendEntry({ creatorId, type: "PAYOUT", amountCents: -10_000n, currency: "VND" });
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { creatorId } });
    expect(wallet.balanceAvailableCents).toBe(0n);
    expect(wallet.balancePaidCents).toBe(10_000n);
  });

  it("keeps every entry in the immutable ledger (never overwrites history)", async () => {
    const entries = await prisma.walletTransaction.findMany({
      where: { wallet: { creatorId } },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((e) => e.type)).toEqual(["VIEW_REVENUE", "PAYOUT"]);
  });
});
