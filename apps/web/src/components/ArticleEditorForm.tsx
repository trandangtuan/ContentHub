"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { api } from "@/lib/api-client";
import { Editor, type EditorStats } from "@/components/Editor";
import { ImageUploadField } from "@/components/ImageUploadField";
import { sanitizeContentHtml } from "@/lib/sanitize";
import { StatusBadge } from "@/components/StatusBadge";

const AUTOSAVE_DEBOUNCE_MS = 2000;

interface Props {
  articleId?: string; // undefined when creating a new article
  initialTitle?: string;
  initialDescription?: string;
  initialCoverImage?: string | null;
  initialHtml?: string;
  initialStatus?: string;
}

/**
 * A "tin tức" (daily news) post is one unit — title + body + optional cover —
 * unlike a Story, which is metadata + a separate set of chapters. So this
 * form does it all in one autosaving page, the same way ChapterEditorForm
 * does for a single chapter's body.
 */
export function ArticleEditorForm({ articleId: initialArticleId, initialTitle, initialDescription, initialCoverImage, initialHtml, initialStatus }: Props) {
  const router = useRouter();
  const { session } = useSession();

  const [articleId, setArticleId] = useState(initialArticleId ?? null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [coverImage, setCoverImage] = useState<string | null>(initialCoverImage ?? null);
  const [stats, setStats] = useState<EditorStats>({ html: initialHtml ?? "", wordCount: 0, readingTimeMinutes: 0 });
  const [status, setStatus] = useState(initialStatus ?? "DRAFT");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = useState(false);

  const latest = useRef({ title, description, coverImage, stats, articleId });
  latest.current = { title, description, coverImage, stats, articleId };

  const save = useCallback(async () => {
    if (!session?.csrfToken) return;
    const { title: t, description: d, coverImage: c, stats: s, articleId: id } = latest.current;
    if (!t.trim()) return;

    setSaveState("saving");
    try {
      if (!id) {
        const created = await api.createArticle(session.csrfToken, { title: t, description: d, coverImage: c ?? undefined, bodyHtml: s.html });
        setArticleId(created.id);
        router.replace(`/dashboard/articles/${created.id}`);
      } else {
        await api.updateArticle(session.csrfToken, id, { title: t, description: d, coverImage: c ?? undefined, bodyHtml: s.html });
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [session, router]);

  // Autosave (same pattern as ChapterEditorForm): debounced so we don't hammer the API on every keystroke.
  useEffect(() => {
    if (!title && !description && !stats.html) return;
    const timer = setTimeout(save, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, stats.html, coverImage]);

  async function publishNow() {
    if (!articleId || !session?.csrfToken) return;
    await save();
    await api.publishArticle(session.csrfToken, articleId);
    setStatus("PUBLISHED");
  }

  async function unpublishNow() {
    if (!articleId || !session?.csrfToken) return;
    await api.unpublishArticle(session.csrfToken, articleId);
    setStatus("UNPUBLISHED");
  }

  function addNewArticle() {
    router.push("/dashboard/articles/new");
  }

  async function deleteArticleNow() {
    if (!articleId || !session?.csrfToken) return;
    if (!window.confirm(`Xóa tin "${title || "này"}"? Hành động này không thể hoàn tác.`)) return;

    try {
      await api.deleteArticle(session.csrfToken, articleId);
      router.push("/dashboard/articles");
    } catch {
      window.alert("Không xóa được tin này, thử lại sau.");
    }
  }

  async function uploadInlineImage(file: File): Promise<string> {
    if (!session?.csrfToken) throw new Error("Bạn cần đăng nhập lại");
    const result = await api.uploadFile(session.csrfToken, "chapter-image", file, title || "tin-tuc");
    return result.url;
  }

  return (
    <div className="stack">
      <label htmlFor="articleTitle">Tiêu đề</label>
      <input id="articleTitle" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />

      <label htmlFor="articleDescription">Mô tả ngắn</label>
      <textarea id="articleDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />

      <ImageUploadField label="Ảnh bìa" purpose="cover" value={coverImage} onChange={setCoverImage} contextSlug={title || "tin-tuc"} />

      <p className="text-sm text-muted">
        {stats.wordCount} từ · {stats.readingTimeMinutes} phút đọc · <StatusBadge status={status} /> ·{" "}
        {saveState === "saving" ? "Đang lưu..." : saveState === "saved" ? "Đã lưu" : saveState === "error" ? "Lỗi khi lưu" : ""}
      </p>

      <div className="row" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-sm" onClick={save}>
          Lưu nháp
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setPreview((p) => !p)}>
          {preview ? "Quay lại chỉnh sửa" : "Preview"}
        </button>
        {status === "PUBLISHED" ? (
          <button type="button" className="btn btn-sm" onClick={unpublishNow}>
            Gỡ xuống
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={publishNow} disabled={!articleId}>
            Đăng tin
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={addNewArticle}>
          + Tin mới
        </button>
        {articleId && (
          <button type="button" className="btn btn-sm btn-danger" onClick={deleteArticleNow}>
            Xóa tin
          </button>
        )}
      </div>

      {preview ? (
        <article className="chapter-content" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(stats.html) }} />
      ) : (
        <Editor initialHtml={initialHtml} onChange={setStats} onUploadImage={uploadInlineImage} />
      )}
    </div>
  );
}
