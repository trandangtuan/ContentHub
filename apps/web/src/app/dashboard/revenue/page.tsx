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
      <p>
        Doanh thu của bạn đến từ <strong>Revenue Pool</strong> hàng tháng: tổng doanh thu quảng cáo/đăng ký được chia theo{" "}
        <strong>Qualified View Share</strong> — tỉ lệ lượt xem hợp lệ của bạn so với tổng lượt xem hợp lệ toàn nền tảng, sau khi trừ
        phần nền tảng giữ lại và quỹ dự phòng gian lận. Đây <strong>không phải</strong> là "1 lượt xem = X đồng".
      </p>
      {wallet ? (
        <dl>
          <dt>Estimated / Pending (chưa hoàn tất kỳ tính doanh thu)</dt>
          <dd>{(Number(wallet.pendingCents) / 100).toLocaleString("vi-VN")} {wallet.currency}</dd>
          <dt>Available (đã hoàn tất, có thể rút)</dt>
          <dd>{(Number(wallet.availableCents) / 100).toLocaleString("vi-VN")} {wallet.currency}</dd>
          <dt>Paid (đã thanh toán)</dt>
          <dd>{(Number(wallet.paidCents) / 100).toLocaleString("vi-VN")} {wallet.currency}</dd>
        </dl>
      ) : (
        <p>Đang tải...</p>
      )}
      <p>
        Kỳ doanh thu đi qua các trạng thái: OPEN → CALCULATING → FRAUD_REVIEW → FINALIZED → PAYOUT_AVAILABLE. Số liệu có thể thay
        đổi do điều chỉnh gian lận cho đến khi kỳ được FINALIZED.
      </p>
    </section>
  );
}
