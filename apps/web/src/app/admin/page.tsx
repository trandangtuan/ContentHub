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
        <p>Đang tải...</p>
      ) : (
        <table>
          <tbody>
            <tr>
              <td>Users</td>
              <td>{stats.users}</td>
            </tr>
            <tr>
              <td>Creators</td>
              <td>{stats.creators}</td>
            </tr>
            <tr>
              <td>Stories</td>
              <td>{stats.stories}</td>
            </tr>
            <tr>
              <td>Chapters</td>
              <td>{stats.chapters}</td>
            </tr>
            <tr>
              <td>
                <Link href="/admin/reports?status=OPEN">Open reports</Link>
              </td>
              <td>{stats.openReports}</td>
            </tr>
            <tr>
              <td>
                <Link href="/admin/payouts?status=PENDING">Pending payouts</Link>
              </td>
              <td>{stats.pendingPayouts}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
