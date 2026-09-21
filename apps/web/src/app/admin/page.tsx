"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type AdminStats } from "@/lib/api-client";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.admin.getStats().then(setStats);
  }, []);

  return (
    <section>
      <h1>Tổng quan quản trị</h1>
      {!stats ? (
        <p className="text-muted">Đang tải...</p>
      ) : (
        <div className="card-grid">
          <div className="card">
            <p className="text-sm text-muted">Users</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats.users}</p>
          </div>
          <div className="card">
            <p className="text-sm text-muted">Creators</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats.creators}</p>
          </div>
          <div className="card">
            <p className="text-sm text-muted">Stories</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats.stories}</p>
          </div>
          <div className="card">
            <p className="text-sm text-muted">Chapters</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats.chapters}</p>
          </div>
          <Link href="/admin/reports?status=OPEN" className="card">
            <p className="text-sm text-muted">Open reports</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats.openReports}</p>
          </Link>
          <Link href="/admin/payouts?status=PENDING" className="card">
            <p className="text-sm text-muted">Pending payouts</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats.pendingPayouts}</p>
          </Link>
        </div>
      )}
    </section>
  );
}
