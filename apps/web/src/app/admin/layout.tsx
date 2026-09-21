"use client";

import Link from "next/link";
import { useSession } from "@/lib/use-session";

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

  if (loading) return <main className="container">Đang tải...</main>;

  if (!session?.authenticated) {
    return (
      <main className="container">
        <meta name="robots" content="noindex, nofollow" />
        <p>
          Vui lòng <Link href="/login">đăng nhập</Link> để truy cập trang quản trị.
        </p>
      </main>
    );
  }

  if (session.role !== "ADMIN" && session.role !== "MODERATOR") {
    return (
      <main className="container">
        <meta name="robots" content="noindex, nofollow" />
        <p>Tài khoản của bạn không có quyền truy cập trang quản trị.</p>
      </main>
    );
  }

  return (
    <div className="container">
      <meta name="robots" content="noindex, nofollow" />
      <nav>
        <Link href="/admin">Tổng quan</Link> · <Link href="/admin/users">Users</Link> · <Link href="/admin/stories">Stories</Link> ·{" "}
        <Link href="/admin/reports">Reports</Link> · <Link href="/admin/revenue">Revenue</Link> · <Link href="/admin/payouts">Payouts</Link> ·{" "}
        <Link href="/admin/seo">SEO Health</Link>
        {" — "}
        <em>{session.role}</em>
      </nav>
      {children}
    </div>
  );
}
