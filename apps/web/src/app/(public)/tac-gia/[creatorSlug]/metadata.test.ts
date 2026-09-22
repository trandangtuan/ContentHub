import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@contenthub/database";
import { generateMetadata } from "./page";

let creatorSlug: string;

beforeAll(async () => {
  const suffix = Date.now();
  const user = await prisma.user.create({ data: { email: `author-meta-${suffix}@contenthub.dev`, passwordHash: "x", displayName: "Author Meta", role: "CREATOR" } });
  const creator = await prisma.creatorProfile.create({
    data: { userId: user.id, slug: `author-meta-${suffix}`, displayName: "Author Meta Creator", bio: "Tiểu sử tác giả kiểm thử." },
  });
  creatorSlug = creator.slug;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Author page generateMetadata", () => {
  it("indexes an existing author's profile with their bio as the description", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ creatorSlug }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.description).toContain("Tiểu sử");
    expect((meta.alternates as { canonical: string }).canonical).toBe(`https://example.com/tac-gia/${creatorSlug}`);
  });

  it("noindexes a nonexistent author slug rather than throwing", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ creatorSlug: "does-not-exist-xyz" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
