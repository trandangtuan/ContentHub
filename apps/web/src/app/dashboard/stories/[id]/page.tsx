"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type StoryRecord } from "@/lib/api-client";

export default function EditStoryPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const [story, setStory] = useState<StoryRecord | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStory(id).then((s) => {
      setStory(s);
      setTitle(s.title);
      setDescription(s.description ?? "");
    });
  }, [id]);

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setError(null);
    try {
      const updated = await api.updateStory(session.csrfToken, id, { title, description });
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

  if (!story) return <p>Đang tải...</p>;

  return (
    <section>
      <h1>Sửa truyện: {story.title}</h1>
      <p>
        Trạng thái: <strong>{story.status}</strong> · <Link href={`/dashboard/stories/${id}/chapters`}>Quản lý chương</Link>
        {story.status === "PUBLISHED" && (
          <>
            {" · "}
            <a href={`/truyen/${story.slug}`} target="_blank" rel="noreferrer">
              Xem trên trang đọc (Preview)
            </a>
          </>
        )}
      </p>

      <form onSubmit={saveDraft}>
        <label>
          Tiêu đề
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label>
          Mô tả
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        {status ? <p>{status}</p> : null}
        <button type="submit">Lưu nháp</button>
        {story.status === "PUBLISHED" ? (
          <button type="button" onClick={unpublish}>
            Gỡ xuất bản
          </button>
        ) : (
          <button type="button" onClick={publish}>
            Xuất bản
          </button>
        )}
      </form>
    </section>
  );
}
