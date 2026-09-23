"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { api, ApiError } from "@/lib/api-client";
import { CategoryPicker } from "@/components/CategoryPicker";
import { ImageUploadField } from "@/components/ImageUploadField";

export default function NewStoryPage() {
  const router = useRouter();
  const { session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setError(null);
    setSubmitting(true);
    try {
      const story = await api.createStory(session.csrfToken, { title, description, categoryIds, coverImage: coverImage ?? undefined });
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
      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={onSubmit} className="stack">
          <label htmlFor="title">Tiêu đề</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          <label htmlFor="description">Mô tả</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} />
          <label>Thể loại</label>
          <CategoryPicker selectedIds={categoryIds} onChange={setCategoryIds} />
          <ImageUploadField label="Ảnh bìa" purpose="cover" value={coverImage} onChange={setCoverImage} contextSlug={title} />
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu nháp"}
          </button>
        </form>
      </div>
    </section>
  );
}
