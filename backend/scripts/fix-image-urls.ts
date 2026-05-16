/**
 * One-shot migration that strips the hardcoded `http://localhost:4000` prefix
 * from any image URL stored in the database, converting it to a same-origin
 * relative path (e.g. `/uploads/foo.jpg`).
 *
 * Why: those absolute URLs were correct when everything ran on the same Mac,
 * but break the moment the site is opened from another device (phone on the
 * LAN, tablet, etc.) because "localhost" then refers to that other device.
 *
 * Idempotent — running it twice is safe (the second run finds nothing to do).
 *
 * Run:
 *   npx tsx scripts/fix-image-urls.ts
 *
 * Add --dry to preview without writing.
 */
import prisma from "../src/config/db";

const DRY = process.argv.includes("--dry");
// Strip both http and https variants of the same origin.
const PATTERNS = [/https?:\/\/localhost:4000/g];

function stripHost(s: string | null): string | null {
  if (!s) return s;
  let out = s;
  for (const re of PATTERNS) out = out.replace(re, "");
  return out;
}

async function main() {
  console.log(DRY ? "DRY RUN — nothing will be saved." : "Applying fixes…");

  // ----- Articles: imageUrl + body -----
  const articles = await prisma.article.findMany({
    where: {
      OR: PATTERNS.flatMap((re) => [
        { imageUrl: { contains: "://localhost:4000" } },
        { body: { contains: "://localhost:4000" } },
      ]),
    },
    select: { id: true, slug: true, imageUrl: true, body: true },
  });

  console.log(`  • ${articles.length} articles to inspect`);
  let touched = 0;
  for (const a of articles) {
    const newImageUrl = stripHost(a.imageUrl);
    const newBody = stripHost(a.body);
    const changed =
      newImageUrl !== a.imageUrl || (newBody !== null && newBody !== a.body);
    if (!changed) continue;
    touched += 1;
    console.log(`    - ${a.slug}`);
    if (!DRY) {
      await prisma.article.update({
        where: { id: a.id },
        data: {
          ...(newImageUrl !== a.imageUrl ? { imageUrl: newImageUrl } : {}),
          ...(newBody !== null && newBody !== a.body ? { body: newBody } : {}),
        },
      });
    }
  }
  console.log(`  ✔ ${touched} articles updated`);

  // ----- Users: avatarUrl -----
  const users = await prisma.user.findMany({
    where: { avatarUrl: { contains: "://localhost:4000" } },
    select: { id: true, name: true, avatarUrl: true },
  });
  console.log(`  • ${users.length} users with absolute avatarUrl`);
  if (!DRY) {
    for (const u of users) {
      await prisma.user.update({
        where: { id: u.id },
        data: { avatarUrl: stripHost(u.avatarUrl) },
      });
    }
  }

  // ----- Ads: content (HTML) -----
  const ads = await prisma.ad.findMany({
    where: { content: { contains: "://localhost:4000" } },
    select: { id: true, displayName: true, content: true },
  });
  console.log(`  • ${ads.length} ads with absolute URLs`);
  if (!DRY) {
    for (const ad of ads) {
      await prisma.ad.update({
        where: { id: ad.id },
        data: { content: stripHost(ad.content) ?? "" },
      });
    }
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
