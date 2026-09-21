"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface WalletResponse {
  availableCents: string;
  pendingCents: string;
  paidCents: string;
  currency: string;
}

/**
 * Revenue transparency (docs/REVENUE.md, spec #71): explains where the
 * numbers come from instead of showing a single "$123". Nothing here is
 * "guaranteed" — pending can still be adjusted for fraud before it becomes
 * available.
 */
export default function RevenuePage() {
  const [wallet, setWallet] = useState<WalletResponse | null>(null);

  useEffect(() => {
    api.getWallet().then((r) => setWallet(r as WalletResponse));
  }, []);

  return (
    <section>
      <h1>Doanh thu</h1>
      <p className="text-muted">
        Doanh thu của bạn đến từ <strong>Revenue Pool</strong> hàng tháng: tổng doanh thu quảng cáo/đăng ký được chia theo{" "}
        <strong>Qualified View Share</strong> — tỉ lệ lượt xem hợp lệ của bạn so với tổng lượt xem hợp lệ toàn nền tảng, sau khi trừ
        phần nền tảng giữ lại và quỹ dự phòng gian lận. Đây <strong>không phải</strong> là &quot;1 lượt xem = X đồng&quot;.
      </p>
      {wallet ? (
        <div className="card-grid" style={{ marginTop: "1.5rem" }}>
          <div className="card">
            <p className="text-sm text-muted">Estimated / Pending (chưa hoàn tất kỳ tính doanh thu)</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {(Number(wallet.pendingCents) / 100).toLocaleString("vi-VN")} {wallet.currency}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-muted">Available (đã hoàn tất, có thể rút)</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {(Number(wallet.availableCents) / 100).toLocaleString("vi-VN")} {wallet.currency}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-muted">Paid (đã thanh toán)</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {(Number(wallet.paidCents) / 100).toLocaleString("vi-VN")} {wallet.currency}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted">Đang tải...</p>
      )}
      <p className="text-sm text-muted" style={{ marginTop: "1.5rem" }}>
        Kỳ doanh thu đi qua các trạng thái: OPEN → CALCULATING → FRAUD_REVIEW → FINALIZED → PAYOUT_AVAILABLE. Số liệu có thể thay
        đổi do điều chỉnh gian lận cho đến khi kỳ được FINALIZED.
      </p>
    </section>
  );
}
