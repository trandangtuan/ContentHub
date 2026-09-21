"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login({ email, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? "Email hoặc mật khẩu không đúng" : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <meta name="robots" content="noindex, nofollow" />
      <div className="auth-card">
        <h1>Đăng nhập</h1>
        <p className="auth-subtitle">Chào mừng trở lại ContentHub</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label htmlFor="password">Mật khẩu</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error ? <p role="alert">{error}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Đang xử lý..." : "Đăng nhập"}
          </button>
        </form>
        <p className="auth-switch">
          Chưa có tài khoản? <Link href="/register">Đăng ký</Link>
        </p>
      </div>
    </main>
  );
}
