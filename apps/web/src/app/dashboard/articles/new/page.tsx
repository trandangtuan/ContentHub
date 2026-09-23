"use client";

import { ArticleEditorForm } from "@/components/ArticleEditorForm";

export default function NewArticlePage() {
  return (
    <section>
      <h1>Viết tin mới</h1>
      <div className="card">
        <ArticleEditorForm />
      </div>
    </section>
  );
}
