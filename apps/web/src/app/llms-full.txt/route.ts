import { prisma } from "@contenthub/database";
import { buildLlmsFullTxt } from "@contenthub/seo";
import { getSeoConfig } from "@/lib/seo-config";

export async function GET() {
  const config = getSeoConfig();

  const publicStoryWhere = { type: "STORY" as const, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, deletedAt: null };

  const [totalPublicStories, totalPublicCategories, totalPublicAuthors, categories] = await Promise.all([
    prisma.content.count({ where: publicStoryWhere }),
    prisma.category.count({ where: { deletedAt: null } }),
    prisma.creatorProfile.count({ where: { deletedAt: null, contents: { some: publicStoryWhere } } }),
    prisma.category.findMany({
      where: { deletedAt: null, contents: { some: { content: publicStoryWhere } } },
      select: { name: true, slug: true, _count: { select: { contents: true } } },
      orderBy: { contents: { _count: "desc" } },
      take: 10,
    }),
  ]);

  const text = buildLlmsFullTxt(config, {
    totalPublicStories,
    totalPublicCategories,
    totalPublicAuthors,
    topCategories: categories.map((c) => ({ name: c.name, slug: c.slug })),
  });

  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
