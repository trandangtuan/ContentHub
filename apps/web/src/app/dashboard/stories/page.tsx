"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type StoryRecord } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";

export default function StoriesListPage() {
  const [stories, setStories] = useState<StoryRecord[] | null>(null);

  useEffect(() => {
    api.listMyStories().then((res) => setStories(res.stories));
  }, []);

  return (
    <section>
      <div className="row-between">
        <h1>Truyện của tôi</h1>
        <Link href="/dashboard/stories/new" className="btn btn-primary">
          + Tạo truyện mới
        </Link>
      </div>
      {stories === null ? (
        <p className="text-muted">Đang tải...</p>
      ) : stories.length === 0 ? (
        <p className="empty-state">Bạn chưa có truyện nào. Bấm &ldquo;Tạo truyện mới&rdquo; để bắt đầu.</p>
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
            {stories.map((story) => (
              <tr key={story.id}>
                <td>{story.title}</td>
                <td>
                  <StatusBadge status={story.status} />
                </td>
                <td>
                  <Link href={`/dashboard/stories/${story.id}`} className="btn btn-sm">
                    Sửa
                  </Link>{" "}
                  <Link href={`/dashboard/stories/${story.id}/chapters`} className="btn btn-sm">
                    Chương
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
