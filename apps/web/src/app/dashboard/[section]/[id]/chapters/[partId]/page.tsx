"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { contentTypeByPrefix } from "@contenthub/seo";
import { api, type PartRecord } from "@/lib/api-client";
import { ContentPartEditorForm } from "@/components/ContentPartEditorForm";

export default function EditChapterPage() {
  const { section, id, partId } = useParams<{ section: string; id: string; partId: string }>();
  const config = contentTypeByPrefix(section);
  const [part, setPart] = useState<PartRecord | null>(null);

  useEffect(() => {
    if (!config || config.partsMode !== "multi") return;
    setPart(null);
    api.content(config).getPart(partId).then(setPart);
  }, [config, partId]);

  if (!config || config.partsMode !== "multi") return <p role="alert">Loại nội dung này không có chương.</p>;
  if (!part) return <p className="text-muted">Đang tải...</p>;

  return (
    <section>
      <h1>Sửa chương</h1>
      <div className="card">
        <ContentPartEditorForm
          key={part.id}
          config={config}
          parentItemId={id}
          partId={part.id}
          initialTitle={part.title}
          initialHtml={part.bodyHtml ?? ""}
          initialStatus={part.status}
        />
      </div>
    </section>
  );
}
