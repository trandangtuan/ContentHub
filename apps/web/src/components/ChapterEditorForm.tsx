"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { api } from "@/lib/api-client";
import { Editor, type EditorStats } from "@/components/Editor";
import { sanitizeContentHtml } from "@/lib/sanitize";
import { StatusBadge } from "@/components/StatusBadge";

const AUTOSAVE_DEBOUNCE_MS = 2000;

interface Props {
  storyId: string;
  chapterId?: string; // undefined when creating a new chapter
  initialTitle?: string;
  initialHtml?: string;
  initialStatus?: string;
}

/**
 * Shared by /dashboard/stories/[id]/chapters/new and .../chapters/[chapterId]
 * (docs/ARCHITECTURE.md #6): autosave, draft/preview/publish/schedule, live
 * word count + reading time. A new chapter is created on the first autosave
 * and the URL is swapped to the edit route so later saves PATCH instead of
 * re-creating.
 */
export function ChapterEditorForm({ storyId, chapterId: initialChapterId, initialTitle, initialHtml, initialStatus }: Props) {
  const router = useRouter();
  const { session } = useSession();

  const [chapterId, setChapterId] = useState(initialChapterId ?? null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [stats, setStats] = useState<EditorStats>({ html: initialHtml ?? "", wordCount: 0, readingTimeMinutes: 0 });
  const [status, setStatus] = useState(initialStatus ?? "DRAFT");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const latest = useRef({ title, stats, chapterId, storyId });
  latest.current = { title, stats, chapterId, storyId };

  const save = useCallback(async () => {
    if (!session?.csrfToken) return;
    const { title: t, stats: s, chapterId: id, storyId: sid } = latest.current;
    if (!t.trim()) return;

    setSaveState("saving");
    try {
      if (!id) {
        const created = await api.createChapter(session.csrfToken, sid, { title: t, bodyHtml: s.html });
        setChapterId(created.id);
        router.replace(`/dashboard/stories/${sid}/chapters/${created.id}`);
      } else {
        await api.updateChapter(session.csrfToken, id, { title: t, bodyHtml: s.html });
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [session, router]);

  // Autosave (docs/ARCHITECTURE.md #6): debounced so we don't hammer the API on every keystroke.
  useEffect(() => {
    if (!title && !stats.html) return;
    const timer = setTimeout(save, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, stats.html]);

  async function publishNow() {
    if (!chapterId || !session?.csrfToken) return;
    await save();
    await api.publishChapter(session.csrfToken, chapterId);
    setStatus("PUBLISHED");
  }

  async function schedule() {
    if (!chapterId || !session?.csrfToken || !scheduledAt) return;
    await save();
    await api.publishChapter(session.csrfToken, chapterId, new Date(scheduledAt).toISOString());
    setStatus("SCHEDULED");
  }

  async function uploadChapterImage(file: File): Promise<string> {
    if (!session?.csrfToken) throw new Error("Bạn cần đăng nhập lại");
    const result = await api.uploadFile(session.csrfToken, "chapter-image", file, title || "chuong");
    return result.url;
  }

  return (
    <div className="stack">
      <label htmlFor="chapterTitle">Tiêu đề chương</label>
      <input id="chapterTitle" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />

      <p className="text-sm text-muted">
        {stats.wordCount} từ · {stats.readingTimeMinutes} phút đọc · <StatusBadge status={status} /> ·{" "}
        {saveState === "saving" ? "Đang lưu..." : saveState === "saved" ? "Đã lưu" : saveState === "error" ? "Lỗi khi lưu" : ""}
      </p>

      <div className="row" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-sm" onClick={save}>
          Save draft
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setPreview((p) => !p)}>
          {preview ? "Quay lại chỉnh sửa" : "Preview"}
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={publishNow} disabled={!chapterId}>
          Publish
        </button>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={{ width: "auto" }} />
        <button type="button" className="btn btn-sm" onClick={schedule} disabled={!chapterId || !scheduledAt}>
          Schedule publish
        </button>
      </div>

      {preview ? (
        <article className="chapter-content" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(stats.html) }} />
      ) : (
        <Editor initialHtml={initialHtml} onChange={setStats} onUploadImage={uploadChapterImage} />
      )}
    </div>
  );
}
