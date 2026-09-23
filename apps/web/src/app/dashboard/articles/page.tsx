"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type ArticleRecord } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";

export default function ArticlesListPage() {
  const [articles, setArticles] = useState<ArticleRecord[] | null>(null);

  useEffect(() => {
    api.listMyArticles().then((res) => setArticles(res.articles));
  }, []);

  return (
    <section>
      <div className="row-between">
        <h1>Tin tức của tôi</h1>
        <Link href="/dashboard/articles/new" className="btn btn-primary">
          + Viết tin mới
        </Link>
      </div>
      {articles === null ? (
        <p className="text-muted">Đang tải...</p>
      ) : articles.length === 0 ? (
        <p className="empty-state">Bạn chưa có tin tức nào. Bấm &ldquo;Viết tin mới&rdquo; để bắt đầu.</p>
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
            {articles.map((article) => (
              <tr key={article.id}>
                <td>{article.title}</td>
                <td>
                  <StatusBadge status={article.status} />
                </td>
                <td>
                  <Link href={`/dashboard/articles/${article.id}`} className="btn btn-sm">
                    Sửa
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
