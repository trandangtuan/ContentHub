"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { api } from "@/lib/api-client";

/** Auth-aware corner of the site header — the only client-rendered piece of an otherwise server-rendered public layout. */
export function AuthNav() {
  const router = useRouter();
  const { session, loading } = useSession();

  async function logout() {
    await api.logout();
    router.push("/");
    router.refresh();
  }

  if (loading) return <span style={{ width: 80, display: "inline-block" }} />;

  if (!session?.authenticated) {
    return (
      <div className="site-header-actions">
        <Link href="/login" className="btn btn-ghost btn-sm">
          Đăng nhập
        </Link>
        <Link href="/register" className="btn btn-primary btn-sm">
          Đăng ký
        </Link>
      </div>
    );
  }

  return (
    <div className="site-header-actions">
      {(session.role === "ADMIN" || session.role === "MODERATOR") && (
        <Link href="/admin" className="btn btn-ghost btn-sm">
          Quản trị
        </Link>
      )}
      <Link href="/dashboard" className="btn btn-ghost btn-sm">
        Creator Studio
      </Link>
      <button type="button" className="btn btn-sm" onClick={logout}>
        Đăng xuất
      </button>
    </div>
  );
}
