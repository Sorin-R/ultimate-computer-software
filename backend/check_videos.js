const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const articles = await prisma.article.findMany({
      where: {
        body: {
          contains: "youtube"
        }
      },
      select: {
        id: true,
        title: true,
        slug: true,
        body: true
      },
      take: 5
    });
    
    console.log("Articles with YouTube links:", articles.length);
    articles.forEach(a => {
      console.log(`- ${a.slug}: ${a.title}`);
      if (a.body.includes("iframe")) {
        console.log("  -> Has iframe tag");
      }
    });
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
