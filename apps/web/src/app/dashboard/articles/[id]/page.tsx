"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type ArticleRecord } from "@/lib/api-client";
import { ArticleEditorForm } from "@/components/ArticleEditorForm";

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<ArticleRecord | null>(null);

  useEffect(() => {
    setArticle(null);
    api.getArticle(id).then(setArticle);
  }, [id]);

  if (!article) return <p className="text-muted">Đang tải...</p>;

  return (
    <section>
      <h1>Sửa tin tức</h1>
      <div className="card">
        <ArticleEditorForm
          key={article.id}
          articleId={article.id}
          initialTitle={article.title}
          initialDescription={article.description ?? ""}
          initialCoverImage={article.coverImage}
          initialHtml={article.article?.bodyHtml ?? ""}
          initialStatus={article.status}
        />
      </div>
    </section>
  );
}
