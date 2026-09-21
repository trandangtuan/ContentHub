"use client";

import { useEffect, useState } from "react";
import { api, type SeoHealth } from "@/lib/api-client";

/** SEO Health (spec #75): indexed candidates, noindex, missing title/description/cover, duplicate slugs. */
export default function AdminSeoHealthPage() {
  const [health, setHealth] = useState<SeoHealth | null>(null);

  useEffect(() => {
    api.admin.getSeoHealth().then(setHealth);
  }, []);

  if (!health) return <p className="text-muted">Đang tải...</p>;

  const rows: { label: string; value: number; warn: boolean }[] = [
    { label: "Tổng số truyện public đã publish", value: health.totalPublic, warn: false },
    { label: "Thiếu mô tả (description)", value: health.missingDescription, warn: health.missingDescription > 0 },
    { label: "Thiếu ảnh bìa (cover)", value: health.missingCover, warn: health.missingCover > 0 },
    { label: "Đang bị noindex", value: health.noindexed, warn: health.noindexed > 0 },
    { label: "Slug trùng lặp (phải luôn = 0, được đảm bảo bởi unique constraint)", value: health.duplicateSlugs, warn: health.duplicateSlugs > 0 },
    { label: "Đã publish nhưng chưa có chương nào published (thin content)", value: health.publishedWithoutChapters, warn: health.publishedWithoutChapters > 0 },
  ];

  return (
    <section>
      <h1>SEO Health</h1>
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.warn ? <span className="badge badge-warning">{r.value}</span> : r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
