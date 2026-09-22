"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type StoryRecord } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryPicker } from "@/components/CategoryPicker";

export default function EditStoryPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const [story, setStory] = useState<StoryRecord | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStory(id).then((s) => {
      setStory(s);
      setTitle(s.title);
      setDescription(s.description ?? "");
      setCategoryIds(s.categories?.map((c) => c.category.id) ?? []);
    });
  }, [id]);

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setError(null);
    try {
      const updated = await api.updateStory(session.csrfToken, id, { title, description, categoryIds });
      setStory(updated);
      setStatus("Đã lưu.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
    }
  }

  async function publish() {
    if (!session?.csrfToken) return;
    setError(null);
    try {
      const updated = await api.publishStory(session.csrfToken, id);
      setStory(updated as StoryRecord);
      setStatus("Đã xuất bản.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xuất bản (kiểm tra tiêu đề/mô tả)");
    }
  }

  async function unpublish() {
    if (!session?.csrfToken) return;
    const updated = await api.unpublishStory(session.csrfToken, id);
    setStory(updated as StoryRecord);
    setStatus("Đã gỡ xuất bản.");
  }

  if (!story) return <p className="text-muted">Đang tải...</p>;

  return (
    <section>
      <div className="row-between">
        <h1>Sửa truyện: {story.title}</h1>
        <StatusBadge status={story.status} />
      </div>
      <p className="text-sm text-muted" style={{ marginBottom: "1.5rem" }}>
        <Link href={`/dashboard/stories/${id}/chapters`}>Quản lý chương</Link>
        {story.status === "PUBLISHED" && (
          <>
            {" · "}
            <a href={`/truyen/${story.slug}`} target="_blank" rel="noreferrer">
              Xem trên trang đọc (Preview)
            </a>
          </>
        )}
      </p>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={saveDraft} className="stack">
          <label htmlFor="title">Tiêu đề</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          <label htmlFor="description">Mô tả</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} />
          <label>Thể loại</label>
          <CategoryPicker selectedIds={categoryIds} onChange={setCategoryIds} />
          {error ? <p role="alert">{error}</p> : null}
          {status ? <p className="text-sm text-muted">{status}</p> : null}
          <div className="row">
            <button type="submit" className="btn">
              Lưu nháp
            </button>
            {story.status === "PUBLISHED" ? (
              <button type="button" className="btn btn-danger" onClick={unpublish}>
                Gỡ xuất bản
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={publish}>
                Xuất bản
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
