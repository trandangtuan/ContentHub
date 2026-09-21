import Link from "next/link";
import Image from "next/image";

export interface StoryCardData {
  slug: string;
  title: string;
  coverImage: string | null;
  shortDescription: string | null;
  creatorName?: string;
}

export function StoryCard({ story }: { story: StoryCardData }) {
  return (
    <article className="story-card">
      <Link href={`/truyen/${story.slug}`}>
        <div className="story-card-cover">
          {story.coverImage ? (
            <Image
              src={story.coverImage}
              alt={`Ảnh bìa truyện ${story.title}`}
              width={300}
              height={400}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-faint)",
                fontSize: "0.75rem",
              }}
            >
              Không có ảnh bìa
            </div>
          )}
        </div>
        <div className="story-card-body">
          <h3>{story.title}</h3>
          {story.creatorName ? <p className="story-card-author">{story.creatorName}</p> : null}
          {story.shortDescription ? <p>{story.shortDescription}</p> : null}
        </div>
      </Link>
    </article>
  );
}
