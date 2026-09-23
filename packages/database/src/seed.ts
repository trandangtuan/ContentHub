import { PrismaClient, ContentType, ContentStatus, ContentVisibility, ContentPartStatus } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const config = await prisma.revenueConfig.upsert({
    where: { version: 1 },
    update: {},
    create: {
      version: 1,
      creatorPoolPercentage: Number(process.env.REVENUE_DEFAULT_CREATOR_POOL_PERCENTAGE ?? 70),
      platformPercentage: Number(process.env.REVENUE_DEFAULT_PLATFORM_PERCENTAGE ?? 25),
      fraudReservePercentage: Number(process.env.REVENUE_DEFAULT_FRAUD_RESERVE_PERCENTAGE ?? 5),
      minimumPayoutThresholdCents: BigInt(process.env.REVENUE_MINIMUM_PAYOUT_THRESHOLD_CENTS ?? 50_000_000),
      currency: process.env.REVENUE_DEFAULT_CURRENCY ?? "VND",
      effectiveFrom: new Date(),
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "creator@contenthub.dev" },
    update: {},
    create: {
      email: "creator@contenthub.dev",
      passwordHash: hashPassword("Password123!"),
      displayName: "Nguyễn Văn An",
      role: "CREATOR",
      locale: "vi",
    },
  });

  const creator = await prisma.creatorProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      slug: "nguyen-van-an",
      displayName: "Nguyễn Văn An",
      bio: "Tác giả truyện tiên hiệp, đam mê viết lách từ 2018.",
    },
  });

  await prisma.wallet.upsert({
    where: { creatorId: creator.id },
    update: {},
    create: { creatorId: creator.id },
  });

  const category = await prisma.category.upsert({
    where: { slug: "tien-hiep" },
    update: {},
    create: { slug: "tien-hiep", name: "Tiên hiệp", description: "Thể loại tiên hiệp, tu luyện, huyền huyễn." },
  });

  const tag = await prisma.tag.upsert({
    where: { slug: "tu-tien" },
    update: {},
    create: { slug: "tu-tien", name: "Tu tiên" },
  });

  const content = await prisma.content.upsert({
    where: { slug: "tu-tien-1000-nam" },
    update: {},
    create: {
      creatorId: creator.id,
      type: ContentType.STORY,
      title: "Tu Tiên 1000 Năm",
      slug: "tu-tien-1000-nam",
      description:
        "Một câu chuyện tu tiên kéo dài nghìn năm, kể về hành trình của một thiếu niên bình thường trở thành bậc đại năng khuynh đảo tam giới.",
      shortDescription: "Hành trình tu tiên nghìn năm của một thiếu niên bình thường.",
      coverImage: "https://picsum.photos/seed/tu-tien-1000-nam/600/800",
      status: ContentStatus.PUBLISHED,
      visibility: ContentVisibility.PUBLIC,
      language: "vi",
      publishedAt: new Date(),
      attributes: { subtitle: "Thiên đạo vô tình", ageRating: "13+" },
      categories: { create: [{ categoryId: category.id }] },
      tags: { create: [{ tagId: tag.id }] },
      seoMetadata: {
        create: {
          seoDescription: "Đọc Tu Tiên 1000 Năm - truyện tiên hiệp hấp dẫn, cập nhật chương mới liên tục.",
        },
      },
    },
  });

  for (let i = 1; i <= 3; i++) {
    await prisma.contentPart.upsert({
      where: { contentId_slug: { contentId: content.id, slug: `chuong-${i}` } },
      update: {},
      create: {
        contentId: content.id,
        title: `Chương ${i}`,
        slug: `chuong-${i}`,
        position: i,
        bodyHtml: `<p>Nội dung chương ${i} của Tu Tiên 1000 Năm. Đây là bản seed dữ liệu mẫu dùng cho phát triển.</p>`,
        bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Nội dung chương ${i}` }] }] },
        wordCount: 12,
        readingTimeMinutes: 1,
        status: ContentPartStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  console.log("Seed complete:", { config: config.version, creator: creator.slug, content: content.slug });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
