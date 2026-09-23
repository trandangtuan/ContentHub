"use client";

import { useParams } from "next/navigation";
import { contentTypeByPrefix } from "@contenthub/seo";
import { ContentPartEditorForm } from "@/components/ContentPartEditorForm";

export default function NewChapterPage() {
  const { section, id } = useParams<{ section: string; id: string }>();
  const config = contentTypeByPrefix(section);

  if (!config || config.partsMode !== "multi") return <p role="alert">Loại nội dung này không có chương.</p>;

  return (
    <section>
      <h1>Chương mới</h1>
      <div className="card">
        <ContentPartEditorForm config={config} parentItemId={id} />
      </div>
    </section>
  );
}
