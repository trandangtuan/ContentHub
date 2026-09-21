"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type ChapterRecord } from "@/lib/api-client";

export default function ChaptersListPage() {
  const { id } = useParams<{ id: string }>();
  const [chapters, setChapters] = useState<ChapterRecord[] | null>(null);

  useEffect(() => {
    api.listChapters(id).then((res) => setChapters(res.chapters));
  }, [id]);

  return (
    <section>
      <h1>Danh sách chương</h1>
      <p>
        <Link href={`/dashboard/stories/${id}/chapters/new`}>+ Thêm chương mới</Link>
      </p>
      {chapters === null ? (
        <p>Đang tải...</p>
      ) : chapters.length === 0 ? (
        <p>Chưa có chương nào.</p>
      ) : (
        <ol>
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <Link href={`/dashboard/stories/${id}/chapters/${chapter.id}`}>{chapter.title}</Link> — {chapter.status} ({chapter.wordCount} từ, {chapter.readingTimeMinutes} phút)
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
