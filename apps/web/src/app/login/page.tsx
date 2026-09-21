"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    } catch (err) {
      setError(err instanceof ApiError ? "Email hoặc mật khẩu không đúng" : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <meta name="robots" content="noindex, nofollow" />
      <h1>Đăng nhập</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mật khẩu
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Đang xử lý..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
