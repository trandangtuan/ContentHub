"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type PayoutRecord } from "@/lib/api-client";

export default function AdminPayoutsPage() {
  return (
    <Suspense fallback={<p>Đang tải...</p>}>
      <AdminPayoutsPageInner />
    </Suspense>
  );
}

function AdminPayoutsPageInner() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [payouts, setPayouts] = useState<PayoutRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.admin.listPayouts({ status: status || undefined, limit: 50 });
    setPayouts(res.items);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function setPayoutStatus(id: string, next: "PROCESSING" | "PAID" | "FAILED" | "REVERSED") {
    if (!session?.csrfToken) return;
    setError(null);
    let failureReason: string | undefined;
    if (next === "FAILED") {
      failureReason = window.prompt("Lý do thất bại?") ?? undefined;
      if (!failureReason) return;
    }
    if (next === "PAID" && !window.confirm("Xác nhận đã chuyển tiền? Thao tác này sẽ ghi vào ledger và trừ số dư khả dụng.")) return;
    try {
      await api.admin.setPayoutStatus(session.csrfToken, id, next, failureReason);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái payout");
    }
  }

  return (
    <section>
      <h1>Payouts</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Tất cả</option>
        <option value="PENDING">PENDING</option>
        <option value="PROCESSING">PROCESSING</option>
        <option value="PAID">PAID</option>
        <option value="FAILED">FAILED</option>
        <option value="REVERSED">REVERSED</option>
      </select>
      {error ? <p role="alert">{error}</p> : null}

      {payouts === null ? (
        <p>Đang tải...</p>
      ) : payouts.length === 0 ? (
        <p>Không có payout nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Creator</th>
              <th>Số tiền</th>
              <th>Kênh</th>
              <th>Trạng thái</th>
              <th>Kỳ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <td>{p.creator.displayName}</td>
                <td>{(Number(p.amountCents) / 100).toLocaleString("vi-VN")} {p.currency}</td>
                <td>{p.payoutAccount.provider}</td>
                <td>{p.status}</td>
                <td>
                  {new Date(p.periodStart).toLocaleDateString("vi-VN")} – {new Date(p.periodEnd).toLocaleDateString("vi-VN")}
                </td>
                <td>
                  {(p.status === "PENDING" || p.status === "PROCESSING") && (
                    <>
                      {p.status === "PENDING" && (
                        <button type="button" onClick={() => setPayoutStatus(p.id, "PROCESSING")}>
                          Mark processing
                        </button>
                      )}{" "}
                      <button type="button" onClick={() => setPayoutStatus(p.id, "PAID")}>
                        Mark paid
                      </button>{" "}
                      <button type="button" onClick={() => setPayoutStatus(p.id, "FAILED")}>
                        Mark failed
                      </button>
                    </>
                  )}
                  {p.status === "PAID" && (
                    <button type="button" onClick={() => setPayoutStatus(p.id, "REVERSED")}>
                      Reverse
                    </button>
                  )}
                  {p.status === "FAILED" && p.failureReason ? <em> {p.failureReason}</em> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
