"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { contentTypeByPrefix } from "@contenthub/seo";
import { api, type PartRecord } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";

/** Generic chapter list — only reachable for a "multi" partsMode type. */
export default function ChaptersListPage() {
  const { section, id } = useParams<{ section: string; id: string }>();
  const config = contentTypeByPrefix(section);
  const [parts, setParts] = useState<PartRecord[] | null>(null);

  useEffect(() => {
    if (!config || config.partsMode !== "multi") return;
    api.content(config).listParts(id).then(setParts);
  }, [config, id]);

  if (!config || config.partsMode !== "multi") return <p role="alert">Loại nội dung này không có chương.</p>;

  return (
    <section>
      <div className="row-between">
        <h1>Danh sách chương</h1>
        <Link href={`/dashboard/${config.urlPrefix}/${id}/chapters/new`} className="btn btn-primary">
          + Thêm chương mới
        </Link>
      </div>
      {parts === null ? (
        <p className="text-muted">Đang tải...</p>
      ) : parts.length === 0 ? (
        <p className="empty-state">Chưa có chương nào.</p>
      ) : (
        <ol className="chapter-list">
          {parts.map((part) => (
            <li key={part.id}>
              <Link href={`/dashboard/${config.urlPrefix}/${id}/chapters/${part.id}`}>{part.title}</Link>
              <span className="text-sm text-muted">
                {" "}
                — <StatusBadge status={part.status} /> ({part.wordCount} từ, {part.readingTimeMinutes} phút)
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
