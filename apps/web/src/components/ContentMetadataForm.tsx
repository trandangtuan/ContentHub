"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentTypeConfig } from "@contenthub/seo";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type ContentItemRecord } from "@/lib/api-client";
import { CategoryPicker } from "@/components/CategoryPicker";
import { ImageUploadField } from "@/components/ImageUploadField";

interface Props {
  config: ContentTypeConfig;
  item?: ContentItemRecord; // absent when creating
}

/**
 * Metadata-only form for a "multi" partsMode type's item (title, description,
 * cover, categories) — its body lives in separately-managed parts (chapters),
 * unlike a "single" type, which uses ContentPartEditorForm for everything.
 */
export function ContentMetadataForm({ config, item }: Props) {
  const router = useRouter();
  const { session } = useSession();
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(item?.categories?.map((c) => c.category.id) ?? []);
  const [coverImage, setCoverImage] = useState<string | null>(item?.coverImage ?? null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contentApi = api.content(config);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setError(null);
    setSubmitting(true);
    try {
      if (!item) {
        const created = await contentApi.create(session.csrfToken, { title, description, categoryIds, coverImage: coverImage ?? undefined });
        router.push(`/dashboard/${config.urlPrefix}/${created.id}`);
      } else {
        await contentApi.update(session.csrfToken, item.id, { title, description, categoryIds, coverImage: coverImage ?? undefined });
        setStatus("Đã lưu.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể lưu");
    } finally {
      setSubmitting(false);
    }
  }

  async function publish() {
    if (!item || !session?.csrfToken) return;
    setError(null);
    try {
      await contentApi.publish(session.csrfToken, item.id);
      setStatus("Đã xuất bản.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xuất bản (kiểm tra tiêu đề/mô tả)");
    }
  }

  async function unpublish() {
    if (!item || !session?.csrfToken) return;
    await contentApi.unpublish(session.csrfToken, item.id);
    setStatus("Đã gỡ xuất bản.");
    router.refresh();
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <form onSubmit={onSubmit} className="stack">
        <label htmlFor="title">Tiêu đề</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        <label htmlFor="description">Mô tả</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} />
        <label>Thể loại</label>
        <CategoryPicker selectedIds={categoryIds} onChange={setCategoryIds} />
        <ImageUploadField label="Ảnh bìa" purpose="cover" value={coverImage} onChange={setCoverImage} contextSlug={item?.slug ?? title} />
        {error ? <p role="alert">{error}</p> : null}
        {status ? <p className="text-sm text-muted">{status}</p> : null}
        <div className="row">
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu nháp"}
          </button>
          {item &&
            (item.status === "PUBLISHED" ? (
              <button type="button" className="btn btn-danger" onClick={unpublish}>
                Gỡ xuất bản
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={publish}>
                Xuất bản
              </button>
            ))}
        </div>
      </form>
    </div>
  );
}
