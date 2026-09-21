"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface AnalyticsResponse {
  followerCount: number;
  stories: { id: string; title: string; slug: string; rawViews: number; qualifiedViews: number; monetizedViews: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    api.getAnalytics().then((r) => setData(r as AnalyticsResponse));
  }, []);

  if (!data) return <p className="text-muted">Đang tải...</p>;

  return (
    <section>
      <h1>Analytics</h1>
      <div className="card" style={{ marginBottom: "1.5rem", maxWidth: 240 }}>
        <p className="text-sm text-muted">Followers</p>
        <p style={{ fontSize: "1.75rem", fontWeight: 700 }}>{data.followerCount}</p>
      </div>
      {data.stories.length === 0 ? (
        <p className="empty-state">Bạn chưa có truyện nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Truyện</th>
              <th>Raw views</th>
              <th>Qualified views</th>
              <th>Monetized views</th>
            </tr>
          </thead>
          <tbody>
            {data.stories.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td>{s.rawViews}</td>
                <td>{s.qualifiedViews}</td>
                <td>{s.monetizedViews}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-sm text-muted" style={{ marginTop: "1rem" }}>
        Raw views = tổng lượt xem thô. Qualified views = lượt xem hợp lệ đủ điều kiện tính doanh thu sau khi lọc gian lận/bot.
        Monetized views = lượt xem đã được tính vào doanh thu kỳ hiện tại.
      </p>
    </section>
  );
}
