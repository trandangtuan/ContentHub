"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type StoryRecord } from "@/lib/api-client";

export default function StoriesListPage() {
  const [stories, setStories] = useState<StoryRecord[] | null>(null);

  useEffect(() => {
    api.listMyStories().then((res) => setStories(res.stories));
  }, []);

  return (
    <section>
      <h1>Truyện của tôi</h1>
      <p>
        <Link href="/dashboard/stories/new">+ Tạo truyện mới</Link>
      </p>
      {stories === null ? (
        <p>Đang tải...</p>
      ) : stories.length === 0 ? (
        <p>Bạn chưa có truyện nào.</p>
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
                <td>{story.status}</td>
                <td>
                  <Link href={`/dashboard/stories/${story.id}`}>Sửa</Link> ·{" "}
                  <Link href={`/dashboard/stories/${story.id}/chapters`}>Chương</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
