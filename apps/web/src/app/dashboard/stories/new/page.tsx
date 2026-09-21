"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { api, ApiError } from "@/lib/api-client";

export default function NewStoryPage() {
  const router = useRouter();
  const { session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setError(null);
    setSubmitting(true);
    try {
      const story = await api.createStory(session.csrfToken, { title, description });
      router.push(`/dashboard/stories/${story.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo truyện");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Tạo truyện mới</h1>
      <form onSubmit={onSubmit}>
        <label>
          Tiêu đề
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label>
          Mô tả
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Lưu nháp"}
        </button>
      </form>
    </section>
  );
}
