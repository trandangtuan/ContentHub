"use client";

import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { AppSidebarNav } from "@/components/AppSidebarNav";

const NAV_ITEMS = [
  { href: "/admin", label: "Tổng quan", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/stories", label: "Stories" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/seo", label: "SEO Health" },
];

/**
 * Admin console (spec #40, #75): Users/Stories/Reports/Revenue/Payouts/SEO.
 * A fully separate route subtree from both the reader and the creator
 * dashboard — client-rendered, RBAC-gated in the browser for UX, but every
 * underlying API call re-checks the role server-side (apps/api's
 * `requireRole`), so this client check is a convenience, not the security
 * boundary.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) return <main className="container" style={{ paddingTop: 40 }}>Đang tải...</main>;

  if (!session?.authenticated) {
    return (
      <main className="container" style={{ paddingTop: 40 }}>
        <meta name="robots" content="noindex, nofollow" />
        <p>
          Vui lòng <Link href="/login">đăng nhập</Link> để truy cập trang quản trị.
        </p>
      </main>
    );
  }

  if (session.role !== "ADMIN" && session.role !== "MODERATOR") {
    return (
      <main className="container" style={{ paddingTop: 40 }}>
        <meta name="robots" content="noindex, nofollow" />
        <p>Tài khoản của bạn không có quyền truy cập trang quản trị.</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <meta name="robots" content="noindex, nofollow" />
      <aside className="app-sidebar">
        <Link href="/admin" className="app-sidebar-brand">
          Quản trị
        </Link>
        <AppSidebarNav items={NAV_ITEMS} />
      </aside>
      <main className="app-main">
        <div className="app-topbar">
          <span className="badge badge-primary">{session.role}</span>
          <Link href="/" className="btn btn-ghost btn-sm">
            ← Về trang chủ
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
