"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type ChapterRecord } from "@/lib/api-client";
import { ChapterEditorForm } from "@/components/ChapterEditorForm";

export default function EditChapterPage() {
  const { id, chapterId } = useParams<{ id: string; chapterId: string }>();
  const [chapter, setChapter] = useState<ChapterRecord | null>(null);

  useEffect(() => {
    setChapter(null);
    api.getChapter(chapterId).then(setChapter);
  }, [chapterId]);

  if (!chapter) return <p className="text-muted">Đang tải...</p>;

  return (
    <section>
      <h1>Sửa chương</h1>
      <div className="card">
        <ChapterEditorForm
          key={chapter.id}
          storyId={id}
          chapterId={chapter.id}
          initialTitle={chapter.title}
          initialHtml={chapter.bodyHtml ?? ""}
          initialStatus={chapter.status}
        />
      </div>
    </section>
  );
}
