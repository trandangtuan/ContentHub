"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { contentTypeByPrefix, paths } from "@contenthub/seo";
import { api, type ContentItemRecord } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";
import { ContentMetadataForm } from "@/components/ContentMetadataForm";
import { ContentPartEditorForm } from "@/components/ContentPartEditorForm";

/**
 * Generic "edit" page for any ContentType. A "multi" type shows metadata +
 * a link to manage its chapters separately; a "single" type shows the full
 * autosaving editor directly, since the item IS its one part.
 */
export default function EditContentItemPage() {
  const { section, id } = useParams<{ section: string; id: string }>();
  const config = contentTypeByPrefix(section);
  const [item, setItem] = useState<ContentItemRecord | null>(null);

  useEffect(() => {
    if (!config) return;
    setItem(null);
    api.content(config).get(id).then(setItem);
  }, [config, id]);

  if (!config) return <p role="alert">Không tìm thấy loại nội dung &ldquo;{section}&rdquo;.</p>;
  if (!item) return <p className="text-muted">Đang tải...</p>;

  if (config.partsMode === "multi") {
    return (
      <section>
        <div className="row-between">
          <h1>
            Sửa {config.itemLabel}: {item.title}
          </h1>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-sm text-muted" style={{ marginBottom: "1.5rem" }}>
          <Link href={`/dashboard/${config.urlPrefix}/${id}/chapters`}>Quản lý chương</Link>
          {item.status === "PUBLISHED" && (
            <>
              {" · "}
              <a href={paths.item(config.urlPrefix, item.slug)} target="_blank" rel="noreferrer">
                Xem trên trang đọc (Preview)
              </a>
            </>
          )}
        </p>
        <ContentMetadataForm config={config} item={item} />
      </section>
    );
  }

  return (
    <section>
      <h1>Sửa {config.itemLabel}</h1>
      <div className="card">
        <ContentPartEditorForm
          key={item.id}
          config={config}
          partId={item.id}
          initialTitle={item.title}
          initialDescription={item.description ?? ""}
          initialCoverImage={item.coverImage}
          initialHtml={item.parts?.[0]?.bodyHtml ?? ""}
          initialStatus={item.status}
        />
      </div>
    </section>
  );
}
