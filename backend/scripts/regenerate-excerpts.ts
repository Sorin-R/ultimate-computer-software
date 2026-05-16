/**
 * One-off maintenance script: regenerate excerpts and re-sanitize bodies
 * for every existing article. Useful after fixing the excerpt logic and
 * the non-breaking-space issue.
 *
 * Run with:  tsx scripts/regenerate-excerpts.ts
 */
import { PrismaClient } from "@prisma/client";
import { generateExcerpt, sanitizeHtml } from "../src/utils/sanitize";

const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.article.findMany({
    select: { id: true, slug: true, body: true },
  });

  console.log(`Found ${articles.length} articles. Regenerating...`);

  for (const article of articles) {
    const cleanedBody = sanitizeHtml(article.body);
    const newExcerpt = generateExcerpt(cleanedBody);

    await prisma.article.update({
      where: { id: article.id },
      data: { body: cleanedBody, excerpt: newExcerpt },
    });

    console.log(`✓ ${article.slug}`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
