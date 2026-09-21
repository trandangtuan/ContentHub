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
        {story.coverImage ? (
          <Image
            src={story.coverImage}
            alt={`Ảnh bìa truyện ${story.title}`}
            width={300}
            height={400}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <h3>{story.title}</h3>
      </Link>
      {story.creatorName ? <p>{story.creatorName}</p> : null}
      {story.shortDescription ? <p>{story.shortDescription}</p> : null}
    </article>
  );
}
