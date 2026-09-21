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

  if (!wallet) return <p className="text-muted">Đang tải...</p>;

  return (
    <section>
      <h1>Ví</h1>
      <div className="card" style={{ marginBottom: "1.5rem", maxWidth: 320 }}>
        <p className="text-sm text-muted">Số dư khả dụng</p>
        <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          {(Number(wallet.availableCents) / 100).toLocaleString("vi-VN")} {wallet.currency}
        </p>
      </div>
      <h2>Lịch sử giao dịch</h2>
      {wallet.transactions.length === 0 ? (
        <p className="empty-state">Chưa có giao dịch nào.</p>
      ) : (
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
                <td className="text-sm text-muted">{t.description}</td>
                <td className="text-sm text-muted">{new Date(t.createdAt).toLocaleString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
