"use client";

import { useParams } from "next/navigation";
import { ChapterEditorForm } from "@/components/ChapterEditorForm";

export default function NewChapterPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <section>
      <h1>Chương mới</h1>
      <ChapterEditorForm storyId={id} />
    </section>
  );
}
