"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentTypeConfig } from "@contenthub/seo";
import { useSession } from "@/lib/use-session";
import { api, type PartRecord } from "@/lib/api-client";
import { Editor, type EditorStats } from "@/components/Editor";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CategoryPicker } from "@/components/CategoryPicker";
import { sanitizeContentHtml } from "@/lib/sanitize";
import { StatusBadge } from "@/components/StatusBadge";

const AUTOSAVE_DEBOUNCE_MS = 2000;

interface Props {
  config: ContentTypeConfig;
  /** Required for a "multi" type (the parent story) — absent for a "single" type, where the item IS the part. */
  parentItemId?: string;
  partId?: string; // undefined when creating
  initialTitle?: string;
  initialDescription?: string; // single mode only (the item's own description)
  initialCoverImage?: string | null; // single mode only
  initialCategoryIds?: string[]; // single mode only — a "multi" type's item categories live on ContentMetadataForm instead
  initialHtml?: string;
  initialStatus?: string;
}

/**
 * One autosaving editor for either shape a ContentType can have (packages/
 * seo's registry): a "single" type's whole item (title + cover + body, all
 * created together — used by dashboard/[section]/new and [id]) or a "multi"
 * type's one chapter (title + body only, belonging to an already-created
 * parent — used by dashboard/[section]/[id]/chapters/new and [chapterId]). A
 * new type reuses this unchanged in whichever shape it declares.
 */
export function ContentPartEditorForm({
  config,
  parentItemId,
  partId: initialPartId,
  initialTitle,
  initialDescription,
  initialCoverImage,
  initialCategoryIds,
  initialHtml,
  initialStatus,
}: Props) {
  const router = useRouter();
  const { session } = useSession();
  const isSingle = config.partsMode === "single";
  const contentApi = useMemo(() => api.content(config), [config]);

  const [partId, setPartId] = useState(initialPartId ?? null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [coverImage, setCoverImage] = useState<string | null>(initialCoverImage ?? null);
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds ?? []);
  const [stats, setStats] = useState<EditorStats>({ html: initialHtml ?? "", wordCount: 0, readingTimeMinutes: 0 });
  const [status, setStatus] = useState(initialStatus ?? "DRAFT");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [siblings, setSiblings] = useState<PartRecord[] | null>(null);

  const latest = useRef({ title, description, coverImage, categoryIds, stats, partId });
  latest.current = { title, description, coverImage, categoryIds, stats, partId };

  // Powers prev/next/add-chapter navigation below — only meaningful for a "multi" type.
  useEffect(() => {
    if (isSingle || !parentItemId) return;
    contentApi.listParts(parentItemId).then(setSiblings);
  }, [isSingle, parentItemId, partId, contentApi]);

  const currentIndex = siblings?.findIndex((p) => p.id === partId) ?? -1;
  const prevPart = siblings && currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextPart = siblings && currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  const save = useCallback(async () => {
    if (!session?.csrfToken) return;
    const { title: t, description: d, coverImage: c, categoryIds: cats, stats: s, partId: id } = latest.current;
    if (!t.trim()) return;

    setSaveState("saving");
    try {
      if (isSingle) {
        if (!id) {
          const created = await contentApi.create(session.csrfToken, { title: t, description: d, coverImage: c ?? undefined, categoryIds: cats, bodyHtml: s.html });
          setPartId(created.id);
          router.replace(`/dashboard/${config.urlPrefix}/${created.id}`);
        } else {
          await contentApi.update(session.csrfToken, id, { title: t, description: d, coverImage: c ?? undefined, categoryIds: cats, bodyHtml: s.html });
        }
      } else {
        if (!id) {
          const created = await contentApi.createPart(session.csrfToken, parentItemId!, { title: t, bodyHtml: s.html });
          setPartId(created.id);
          router.replace(`/dashboard/${config.urlPrefix}/${parentItemId}/chapters/${created.id}`);
        } else {
          await contentApi.updatePart(session.csrfToken, id, { title: t, bodyHtml: s.html });
        }
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [session, router, isSingle, parentItemId, config.urlPrefix, contentApi]);

  // Autosave: debounced so we don't hammer the API on every keystroke.
  useEffect(() => {
    if (!title && !description && !stats.html) return;
    const timer = setTimeout(save, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, stats.html, coverImage, categoryIds]);

  async function publishNow() {
    if (!partId || !session?.csrfToken) return;
    await save();
    if (isSingle) {
      await contentApi.publish(session.csrfToken, partId);
      setStatus("PUBLISHED");
    } else {
      await contentApi.publishPart(session.csrfToken, partId, scheduledAt || undefined);
      setStatus(scheduledAt ? "SCHEDULED" : "PUBLISHED");
    }
  }

  async function unpublishNow() {
    if (!partId || !session?.csrfToken) return;
    if (isSingle) await contentApi.unpublish(session.csrfToken, partId);
    else await contentApi.unpublishPart(session.csrfToken, partId);
    setStatus("UNPUBLISHED");
  }

  function addNew() {
    router.push(isSingle ? `/dashboard/${config.urlPrefix}/new` : `/dashboard/${config.urlPrefix}/${parentItemId}/chapters/new`);
  }

  async function deleteNow() {
    if (!partId || !session?.csrfToken) return;
    const label = isSingle ? config.itemLabel : (config.partLabel ?? "phần").toLowerCase();
    if (!window.confirm(`Xóa ${label} "${title || "này"}"? Hành động này không thể hoàn tác.`)) return;

    try {
      if (isSingle) {
        await contentApi.delete(session.csrfToken, partId);
        router.push(`/dashboard/${config.urlPrefix}`);
      } else {
        await contentApi.deletePart(session.csrfToken, partId);
        const target = nextPart ?? prevPart;
        router.push(target ? `/dashboard/${config.urlPrefix}/${parentItemId}/chapters/${target.id}` : `/dashboard/${config.urlPrefix}/${parentItemId}/chapters`);
      }
    } catch {
      window.alert(`Không xóa được ${label} này, thử lại sau.`);
    }
  }

  async function uploadInlineImage(file: File): Promise<string> {
    if (!session?.csrfToken) throw new Error("Bạn cần đăng nhập lại");
    const result = await api.uploadFile(session.csrfToken, "chapter-image", file, title || config.urlPrefix);
    return result.url;
  }

  return (
    <div className="stack">
      <label htmlFor="partTitle">{isSingle ? "Tiêu đề" : "Tiêu đề chương"}</label>
      <input id="partTitle" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />

      {isSingle && (
        <>
          <label htmlFor="partDescription">Mô tả ngắn</label>
          <textarea id="partDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
          <ImageUploadField label="Ảnh bìa" purpose="cover" value={coverImage} onChange={setCoverImage} contextSlug={title || config.urlPrefix} />
          <label>Thể loại</label>
          <CategoryPicker selectedIds={categoryIds} onChange={setCategoryIds} />
        </>
      )}

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
            {isSingle ? "Gỡ xuống" : "Unpublish"}
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={publishNow} disabled={!partId}>
            {isSingle ? "Đăng tin" : "Publish"}
          </button>
        )}
        {!isSingle && (
          <>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={{ width: "auto" }} />
            <button type="button" className="btn btn-sm" onClick={publishNow} disabled={!partId || !scheduledAt}>
              Schedule publish
            </button>
          </>
        )}
      </div>

      <div className="row" style={{ flexWrap: "wrap", alignItems: "center" }}>
        {!isSingle && (
          <>
            <button type="button" className="btn btn-sm" onClick={() => prevPart && router.push(`/dashboard/${config.urlPrefix}/${parentItemId}/chapters/${prevPart.id}`)} disabled={!prevPart}>
              ← Chương trước
            </button>
            <button type="button" className="btn btn-sm" onClick={() => nextPart && router.push(`/dashboard/${config.urlPrefix}/${parentItemId}/chapters/${nextPart.id}`)} disabled={!nextPart}>
              Chương sau →
            </button>
          </>
        )}
        <button type="button" className="btn btn-sm" onClick={addNew}>
          + {isSingle ? config.itemLabel[0]!.toUpperCase() + config.itemLabel.slice(1) : "Chương"} mới
        </button>
        {partId && (
          <button type="button" className="btn btn-sm btn-danger" onClick={deleteNow}>
            {isSingle ? "Xóa tin" : "Xóa chương"}
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
