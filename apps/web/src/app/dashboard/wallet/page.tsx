"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface WalletTransaction {
  type: string;
  amountCents: string;
  balanceAfterCents: string;
  description: string | null;
  createdAt: string;
}

interface WalletResponse {
  availableCents: string;
  pendingCents: string;
  paidCents: string;
  currency: string;
  transactions: WalletTransaction[];
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletResponse | null>(null);

  useEffect(() => {
    api.getWallet().then((r) => setWallet(r as WalletResponse));
  }, []);

  if (!wallet) return <p>Đang tải...</p>;

  return (
    <section>
      <h1>Ví</h1>
      <p>
        Số dư khả dụng: {(Number(wallet.availableCents) / 100).toLocaleString("vi-VN")} {wallet.currency}
      </p>
      <h2>Lịch sử giao dịch</h2>
      <table>
        <thead>
          <tr>
            <th>Loại</th>
            <th>Số tiền</th>
            <th>Số dư sau</th>
            <th>Ghi chú</th>
            <th>Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {wallet.transactions.map((t, i) => (
            <tr key={i}>
              <td>{t.type}</td>
              <td>{(Number(t.amountCents) / 100).toLocaleString("vi-VN")}</td>
              <td>{(Number(t.balanceAfterCents) / 100).toLocaleString("vi-VN")}</td>
              <td>{t.description}</td>
              <td>{new Date(t.createdAt).toLocaleString("vi-VN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
