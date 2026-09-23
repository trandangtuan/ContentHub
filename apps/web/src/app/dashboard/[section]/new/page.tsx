"use client";

import { useParams } from "next/navigation";
import { contentTypeByPrefix } from "@contenthub/seo";
import { ContentMetadataForm } from "@/components/ContentMetadataForm";
import { ContentPartEditorForm } from "@/components/ContentPartEditorForm";

/**
 * Generic "create" page for any ContentType. A "multi" type (chapters
 * managed separately) gets a metadata-only form; a "single" type gets the
 * full autosaving editor immediately, since it has no separate parts step.
 */
export default function NewContentItemPage() {
  const { section } = useParams<{ section: string }>();
  const config = contentTypeByPrefix(section);

  if (!config) return <p role="alert">Không tìm thấy loại nội dung &ldquo;{section}&rdquo;.</p>;

  return (
    <section>
      <h1>{config.partsMode === "multi" ? "Tạo" : "Viết"} {config.itemLabel} mới</h1>
      {config.partsMode === "multi" ? (
        <ContentMetadataForm config={config} />
      ) : (
        <div className="card">
          <ContentPartEditorForm config={config} />
        </div>
      )}
    </section>
  );
}
