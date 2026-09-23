import Link from "next/link";
import Image from "next/image";
import { paths, type ContentTypeConfig } from "@contenthub/seo";

export interface ContentCardData {
  slug: string;
  title: string;
  coverImage: string | null;
  shortDescription: string | null;
  publishedAt?: string | Date | null;
  creatorName?: string;
}

/** Generic card for any ContentType (packages/seo's registry) — a new type needs no new card component. */
export function ContentCard({ config, item, locale = "vi" }: { config: ContentTypeConfig; item: ContentCardData; locale?: string }) {
  const meta = [item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(locale) : null, item.creatorName].filter(Boolean).join(" · ");

  return (
    <article className="story-card">
      <Link href={paths.item(config.urlPrefix, item.slug)}>
        <div className="story-card-cover">
          {item.coverImage ? (
            <Image src={item.coverImage} alt={item.title} width={300} height={config.partsMode === "multi" ? 400 : 200} loading="lazy" decoding="async" />
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
          <h3>{item.title}</h3>
          {meta ? <p className="story-card-author text-sm text-muted">{meta}</p> : null}
          {item.shortDescription ? <p>{item.shortDescription}</p> : null}
        </div>
      </Link>
    </article>
  );
}
