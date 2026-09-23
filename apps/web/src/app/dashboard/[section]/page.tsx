"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { contentTypeByPrefix } from "@contenthub/seo";
import { api, type ContentItemRecord } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";

/** Generic list page for any ContentType (packages/seo's registry) — a new type needs no new page. */
export default function ContentListPage() {
  const { section } = useParams<{ section: string }>();
  const config = contentTypeByPrefix(section);
  const [items, setItems] = useState<ContentItemRecord[] | null>(null);

  useEffect(() => {
    if (!config) return;
    api.content(config).list().then(setItems);
  }, [config]);

  if (!config) return <p role="alert">Không tìm thấy loại nội dung &ldquo;{section}&rdquo;.</p>;

  return (
    <section>
      <div className="row-between">
        <h1>{config.label} của tôi</h1>
        <Link href={`/dashboard/${config.urlPrefix}/new`} className="btn btn-primary">
          + {config.partsMode === "multi" ? "Tạo" : "Viết"} {config.itemLabel} mới
        </Link>
      </div>
      {items === null ? (
        <p className="text-muted">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Bạn chưa có {config.itemLabel} nào. Bấm &ldquo;+ &rdquo; để bắt đầu.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>
                  <Link href={`/dashboard/${config.urlPrefix}/${item.id}`} className="btn btn-sm">
                    Sửa
                  </Link>
                  {config.partsMode === "multi" && (
                    <>
                      {" "}
                      <Link href={`/dashboard/${config.urlPrefix}/${item.id}/chapters`} className="btn btn-sm">
                        Chương
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
