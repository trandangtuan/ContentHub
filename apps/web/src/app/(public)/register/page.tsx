"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.register({ email, password, displayName });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đăng ký thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <meta name="robots" content="noindex, nofollow" />
      <div className="auth-card">
        <h1>Đăng ký</h1>
        <p className="auth-subtitle">Tạo tài khoản để bắt đầu đọc và viết truyện</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="displayName">Tên hiển thị</label>
          <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={1} maxLength={100} />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label htmlFor="password">Mật khẩu</label>
          <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />

          {error ? <p role="alert">{error}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Đang xử lý..." : "Đăng ký"}
          </button>
        </form>
        <p className="auth-switch">
          Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </main>
  );
}
