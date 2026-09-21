import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@contenthub/database";
import { buildPageMetadata, getRobotsMetadata, paths } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";

export function generateMetadata(): Metadata {
  const config = getSeoConfig();
  return buildPageMetadata(config, {
    title: `Tác giả – ${config.siteName}`,
    description: `Danh sách tác giả trên ${config.siteName}.`,
    path: paths.authorList(),
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogType: "website",
  }) as Metadata;
}

export default async function AuthorListPage() {
  const creators = await prisma.creatorProfile.findMany({
    where: { deletedAt: null, contents: { some: { status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } } },
    orderBy: { displayName: "asc" },
  });

  return (
    <main className="container">
      <h1>Tác giả</h1>
      <ul>
        {creators.map((creator) => (
          <li key={creator.id}>
            <Link href={paths.author(creator.slug)}>{creator.displayName}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
