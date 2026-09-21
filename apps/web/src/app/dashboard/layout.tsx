"use client";

import Link from "next/link";
import { useSession } from "@/lib/use-session";

/**
 * Dashboard is a fully separate route subtree from the reader (docs/SEO.md
 * #7): none of this code is imported by /truyen/**, so it never ships to a
 * reader's or crawler's page load.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) return <main className="container">Đang tải...</main>;

  if (!session?.authenticated) {
    return (
      <main className="container">
        <p>
          Vui lòng <Link href="/login">đăng nhập</Link> để truy cập Creator Studio.
        </p>
      </main>
    );
  }

  return (
    <div className="container">
      <meta name="robots" content="noindex, nofollow" />
      <nav>
        <Link href="/dashboard">Dashboard</Link> · <Link href="/dashboard/stories">Truyện</Link> · <Link href="/dashboard/analytics">Analytics</Link> ·{" "}
        <Link href="/dashboard/revenue">Doanh thu</Link> · <Link href="/dashboard/wallet">Ví</Link>
      </nav>
      {children}
    </div>
  );
}
