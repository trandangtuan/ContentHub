import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@contenthub/database";
import { buildPageMetadata, getRobotsMetadata, paths } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";

export function generateMetadata(): Metadata {
  const config = getSeoConfig();
  return buildPageMetadata(config, {
    title: `Thể loại truyện – ${config.siteName}`,
    description: `Danh sách thể loại truyện trên ${config.siteName}.`,
    path: paths.categoryList(),
    robots: getRobotsMetadata({ kind: "static-indexable" }),
    ogType: "website",
  }) as Metadata;
}

export default async function CategoryListPage() {
  const categories = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });

  return (
    <main className="container">
      <h1>Thể loại truyện</h1>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <Link href={paths.category(category.slug)}>{category.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
