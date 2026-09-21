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

  if (!data) return <p>Đang tải...</p>;

  return (
    <section>
      <h1>Analytics</h1>
      <p>Followers: {data.followerCount}</p>
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
      <p>
        <em>
          Raw views = tổng lượt xem thô. Qualified views = lượt xem hợp lệ đủ điều kiện tính doanh thu sau khi lọc gian lận/bot.
          Monetized views = lượt xem đã được tính vào doanh thu kỳ hiện tại.
        </em>
      </p>
    </section>
  );
}
