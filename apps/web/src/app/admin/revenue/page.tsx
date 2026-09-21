"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type RevenueConfigRecord } from "@/lib/api-client";

export default function AdminRevenuePage() {
  const { session } = useSession();
  const [configs, setConfigs] = useState<RevenueConfigRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creatorPool, setCreatorPool] = useState("70");
  const [platform, setPlatform] = useState("25");
  const [fraudReserve, setFraudReserve] = useState("5");
  const [minPayout, setMinPayout] = useState("50000000");
  const [currency, setCurrency] = useState("VND");

  const [creatorId, setCreatorId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustStatus, setAdjustStatus] = useState<string | null>(null);

  async function load() {
    const res = await api.admin.listRevenueConfigs();
    setConfigs(res.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function createConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setError(null);
    try {
      await api.admin.createRevenueConfig(session.csrfToken, {
        creatorPoolPercentage: Number(creatorPool),
        platformPercentage: Number(platform),
        fraudReservePercentage: Number(fraudReserve),
        minimumPayoutThresholdCents: minPayout,
        currency,
        effectiveFrom: new Date().toISOString(),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo config mới");
    }
  }

  async function adjustWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken || !creatorId || !adjustAmount || !adjustReason) return;
    setAdjustStatus(null);
    try {
      await api.admin.adjustWallet(session.csrfToken, creatorId, adjustAmount, adjustReason);
      setAdjustStatus("Đã ghi nhận điều chỉnh vào ledger.");
      setAdjustAmount("");
      setAdjustReason("");
    } catch (err) {
      setAdjustStatus(err instanceof ApiError ? err.message : "Điều chỉnh thất bại");
    }
  }

  return (
    <section>
      <h1>Revenue</h1>

      <h2>Revenue config (versioned — spec #72, never hard-coded)</h2>
      {configs === null ? (
        <p>Đang tải...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Creator %</th>
              <th>Platform %</th>
              <th>Fraud reserve %</th>
              <th>Min payout</th>
              <th>Hiệu lực từ</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={c.id}>
                <td>{c.version}</td>
                <td>{c.creatorPoolPercentage}%</td>
                <td>{c.platformPercentage}%</td>
                <td>{c.fraudReservePercentage}%</td>
                <td>{(Number(c.minimumPayoutThresholdCents) / 100).toLocaleString("vi-VN")} {c.currency}</td>
                <td>{new Date(c.effectiveFrom).toLocaleDateString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Tạo phiên bản mới (phải cộng đúng 100%)</h3>
      <form onSubmit={createConfig}>
        <label>
          Creator pool %
          <input type="number" step="0.01" value={creatorPool} onChange={(e) => setCreatorPool(e.target.value)} />
        </label>
        <label>
          Platform %
          <input type="number" step="0.01" value={platform} onChange={(e) => setPlatform(e.target.value)} />
        </label>
        <label>
          Fraud reserve %
          <input type="number" step="0.01" value={fraudReserve} onChange={(e) => setFraudReserve(e.target.value)} />
        </label>
        <label>
          Minimum payout (cents)
          <input value={minPayout} onChange={(e) => setMinPayout(e.target.value)} />
        </label>
        <label>
          Currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Tạo version mới</button>
      </form>

      <h2>Điều chỉnh ví Creator (Adjust revenue — spec #40)</h2>
      <p>Mọi điều chỉnh được ghi vào wallet_transactions (ledger), không sửa trực tiếp số dư.</p>
      <form onSubmit={adjustWallet}>
        <label>
          Creator ID
          <input value={creatorId} onChange={(e) => setCreatorId(e.target.value)} placeholder="creator_profile.id" required />
        </label>
        <label>
          Số tiền (cents, âm = trừ)
          <input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="ví dụ: 100000 hoặc -50000" required />
        </label>
        <label>
          Lý do
          <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} required />
        </label>
        {adjustStatus ? <p>{adjustStatus}</p> : null}
        <button type="submit">Ghi điều chỉnh</button>
      </form>
    </section>
  );
}
