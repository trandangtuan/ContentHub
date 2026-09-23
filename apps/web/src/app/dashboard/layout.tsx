"use client";

import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { AppSidebarNav } from "@/components/AppSidebarNav";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", exact: true },
  { href: "/dashboard/stories", label: "Truyện" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/revenue", label: "Doanh thu" },
  { href: "/dashboard/wallet", label: "Ví" },
  { href: "/dashboard/profile", label: "Hồ sơ" },
];

/**
 * Dashboard is a fully separate route subtree from the reader (docs/SEO.md
 * #7): none of this code is imported by /truyen/**, so it never ships to a
 * reader's or crawler's page load.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) return <main className="container" style={{ paddingTop: 40 }}>Đang tải...</main>;

  if (!session?.authenticated) {
    return (
      <main className="container" style={{ paddingTop: 40 }}>
        <meta name="robots" content="noindex, nofollow" />
        <p>
          Vui lòng <Link href="/login">đăng nhập</Link> để truy cập Creator Studio.
        </p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <meta name="robots" content="noindex, nofollow" />
      <aside className="app-sidebar">
        <Link href="/dashboard" className="app-sidebar-brand">
          Creator Studio
        </Link>
        <AppSidebarNav items={NAV_ITEMS} />
      </aside>
      <main className="app-main">
        <div className="app-topbar">
          <span className="role-pill">Xin chào, {session.role === "CREATOR" ? "Creator" : session.role}</span>
          <Link href="/" className="btn btn-ghost btn-sm">
            ← Về trang chủ
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
