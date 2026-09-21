"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { api } from "@/lib/api-client";

export default function DashboardHome() {
  const { session } = useSession();
  const [hasCreatorProfile, setHasCreatorProfile] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!session?.authenticated) return;
    setHasCreatorProfile(Boolean(session.creatorProfileId));
  }, [session]);

  async function becomeCreator(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setCreating(true);
    try {
      await api.createCreatorProfile(session.csrfToken, { displayName });
      window.location.reload();
    } finally {
      setCreating(false);
    }
  }

  if (hasCreatorProfile === false) {
    return (
      <section className="auth-page" style={{ minHeight: "auto", padding: "2rem 0" }}>
        <div className="auth-card">
          <h1>Trở thành Creator</h1>
          <form onSubmit={becomeCreator}>
            <label htmlFor="displayName">Tên hiển thị</label>
            <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Đang tạo..." : "Tạo hồ sơ Creator"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1>Creator Studio</h1>
      <div className="card-grid">
        <Link href="/dashboard/stories" className="card">
          <p style={{ fontWeight: 600 }}>Quản lý truyện</p>
          <p className="text-sm text-muted">Tạo, chỉnh sửa và xuất bản truyện của bạn</p>
        </Link>
        <Link href="/dashboard/analytics" className="card">
          <p style={{ fontWeight: 600 }}>Analytics</p>
          <p className="text-sm text-muted">Theo dõi lượt xem và người theo dõi</p>
        </Link>
        <Link href="/dashboard/revenue" className="card">
          <p style={{ fontWeight: 600 }}>Doanh thu</p>
          <p className="text-sm text-muted">Xem cách doanh thu được tính</p>
        </Link>
        <Link href="/dashboard/wallet" className="card">
          <p style={{ fontWeight: 600 }}>Ví</p>
          <p className="text-sm text-muted">Số dư và lịch sử giao dịch</p>
        </Link>
      </div>
    </section>
  );
}
