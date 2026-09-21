"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type ChapterRecord } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";

export default function ChaptersListPage() {
  const { id } = useParams<{ id: string }>();
  const [chapters, setChapters] = useState<ChapterRecord[] | null>(null);

  useEffect(() => {
    api.listChapters(id).then((res) => setChapters(res.chapters));
  }, [id]);

  return (
    <section>
      <div className="row-between">
        <h1>Danh sách chương</h1>
        <Link href={`/dashboard/stories/${id}/chapters/new`} className="btn btn-primary">
          + Thêm chương mới
        </Link>
      </div>
      {chapters === null ? (
        <p className="text-muted">Đang tải...</p>
      ) : chapters.length === 0 ? (
        <p className="empty-state">Chưa có chương nào.</p>
      ) : (
        <ol className="chapter-list">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <Link href={`/dashboard/stories/${id}/chapters/${chapter.id}`}>{chapter.title}</Link>
              <span className="text-sm text-muted">
                {" "}
                — <StatusBadge status={chapter.status} /> ({chapter.wordCount} từ, {chapter.readingTimeMinutes} phút)
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
