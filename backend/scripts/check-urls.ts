import prisma from "../src/config/db";

async function main() {
  const total = await prisma.article.count();
  const withAbsImageUrl = await prisma.article.count({
    where: { imageUrl: { contains: "://" } },
  });
  const withAbsBody = await prisma.article.count({
    where: { body: { contains: "http://localhost:4000" } },
  });
  const ads = await prisma.ad.count({
    where: { content: { contains: "http://localhost:4000" } },
  });
  const users = await prisma.user.count({
    where: { avatarUrl: { contains: "http://localhost:4000" } },
  });

  console.log({
    totalArticles: total,
    articlesWithAbsoluteImageUrl: withAbsImageUrl,
    articlesWithAbsoluteBodyImg: withAbsBody,
    adsWithAbsoluteUrls: ads,
    usersWithAbsoluteAvatar: users,
  });

  const sample = await prisma.article.findMany({
    where: {
      OR: [
        { imageUrl: { contains: "://" } },
        { body: { contains: "http://localhost:4000" } },
      ],
    },
    select: { id: true, slug: true, imageUrl: true },
    take: 5,
  });
  console.log("Sample:", JSON.stringify(sample, null, 2));

  await prisma.$disconnect();
}

main();
