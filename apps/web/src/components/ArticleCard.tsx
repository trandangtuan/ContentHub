import Link from "next/link";
import Image from "next/image";
import { paths } from "@contenthub/seo";

export interface ArticleCardData {
  slug: string;
  title: string;
  coverImage: string | null;
  shortDescription: string | null;
  publishedAt: string | Date | null;
  creatorName?: string;
}

export function ArticleCard({ article, locale = "vi" }: { article: ArticleCardData; locale?: string }) {
  return (
    <article className="story-card">
      <Link href={paths.article(article.slug)}>
        <div className="story-card-cover">
          {article.coverImage ? (
            <Image src={article.coverImage} alt={article.title} width={300} height={200} loading="lazy" decoding="async" />
          ) : (
            <div
              aria-hidden="true"
              style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: "0.75rem" }}
            >
              Không có ảnh
            </div>
          )}
        </div>
        <div className="story-card-body">
          <h3>{article.title}</h3>
          <p className="text-sm text-muted">
            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString(locale) : ""}
            {article.creatorName ? ` · ${article.creatorName}` : ""}
          </p>
          {article.shortDescription ? <p>{article.shortDescription}</p> : null}
        </div>
      </Link>
    </article>
  );
}
