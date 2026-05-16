import { PrismaClient, Category, Tag } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const CONTENT_DIRS = [
  path.join(PROJECT_ROOT, "content", "article photos"),
  path.join(PROJECT_ROOT, "content", "home"),
];
const VIDEO_FILE = path.join(PROJECT_ROOT, "content", "video", "video.txt");
const UPLOAD_SUBDIR = "seeded-content";
const UPLOAD_DIR = path.join(process.cwd(), "uploads", UPLOAD_SUBDIR);
const PUBLIC_UPLOAD_BASE = `http://localhost:4000/uploads/${UPLOAD_SUBDIR}`;

const CATEGORY_KEYWORD_HINTS: Record<string, string> = {
  "artificial-intelligence": "agentic systems",
  robotics: "human robot collaboration",
  cybersecurity: "zero trust operations",
  blockchain: "enterprise tokenization",
  "cloud-computing": "hybrid cloud scale",
  "software-development": "developer productivity",
  "consumer-electronics": "edge AI devices",
  "green-technology": "sustainable infrastructure",
  "space-technology": "satellite intelligence",
  biotechnology: "precision diagnostics",
  "front-end-development": "performance UX",
  "back-end-development": "resilient APIs",
  "self-driving-cars": "autonomous mobility",
  "electric-cars": "battery software",
  "quantum-computing": "quantum workloads",
};

const CATEGORY_TITLES: Record<string, string> = {
  "artificial-intelligence": "AI teams are compressing enterprise delivery timelines",
  robotics: "Robotics teams are accelerating real-world automation plans",
  cybersecurity: "Cybersecurity leaders are hardening defenses at record speed",
  blockchain: "Blockchain programs are moving from pilots to production",
  "cloud-computing": "Cloud computing strategies are shifting to measurable ROI",
  "software-development": "Software teams are shipping faster with stronger quality",
  "consumer-electronics": "Consumer electronics are entering a smarter hardware cycle",
  "green-technology": "Green technology projects are scaling with better economics",
  "space-technology": "Space technology roadmaps are moving into commercial scale",
  biotechnology: "Biotechnology pipelines are integrating software-first workflows",
  "front-end-development": "Front-end development is becoming more performance-driven",
  "back-end-development": "Back-end development is focusing on resilient architectures",
  "self-driving-cars": "Self-driving car programs are entering pragmatic deployment",
  "electric-cars": "Electric car platforms are improving software-defined range",
  "quantum-computing": "Quantum computing experiments are approaching practical pilots",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function buildExcerpt(categoryName: string, hint: string): string {
  return `${categoryName} teams are prioritizing ${hint}, faster release cycles, and practical execution models that connect product strategy with measurable delivery outcomes.`;
}

function buildBody(params: {
  title: string;
  categoryName: string;
  hint: string;
  imageUrl: string;
  videoUrl: string;
  sourceUrl: string;
}): string {
  const { title, categoryName, hint, imageUrl, videoUrl, sourceUrl } = params;

  return `
<article>
  <header>
    <h2>${title}</h2>
    <p>
      In the world of enterprise software, the timeline from whiteboard to launch keeps shrinking.
      ${categoryName} teams are using tighter feedback loops and clearer ownership to ship value faster.
    </p>
  </header>

  <section>
    <h3>Why this matters now</h3>
    <p>
      The current focus is no longer just experimentation. Teams are operationalizing ${hint}
      with measurable delivery checkpoints, stronger governance, and faster release confidence.
    </p>
    <ul>
      <li>Roadmaps are tied directly to business outcomes and adoption signals.</li>
      <li>Cross-functional execution is improving between product, engineering, and operations.</li>
      <li>Teams are reducing cycle time while keeping quality and reliability in scope.</li>
    </ul>
  </section>

  <section>
    <h3>Execution signals to track</h3>
    <ol>
      <li>Lead time from concept to validated release milestone.</li>
      <li>Production stability after rollout and incident recovery speed.</li>
      <li>User adoption and retention after the first 30 days.</li>
    </ol>
    <blockquote>
      Sustainable velocity comes from disciplined iteration, not one-off launch spikes.
    </blockquote>
  </section>

  <section>
    <h3>Visual and video reference</h3>
    <p>
      <img src="${imageUrl}" alt="${categoryName} editorial visual" loading="lazy" />
    </p>
    <p>
      <a href="${videoUrl}">${videoUrl}</a>
    </p>
  </section>

  <footer>
    <p>
      Original source context: <a href="${sourceUrl}" rel="nofollow">${sourceUrl}</a>
    </p>
  </footer>
</article>
`.trim();
}

async function readVideos(): Promise<string[]> {
  const raw = await fs.readFile(VIDEO_FILE, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line));
}

async function collectImages(): Promise<string[]> {
  const files: string[] = [];

  for (const dir of CONTENT_DIRS) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) continue;
      files.push(path.join(dir, entry.name));
    }
  }

  return files.sort();
}

async function prepareUploadImages(images: string[]): Promise<string[]> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const publicUrls: string[] = [];

  for (const srcPath of images) {
    const base = path.basename(srcPath).replace(/\s+/g, "-");
    const targetName = `${slugify(base.replace(/\.[^.]+$/, ""))}${path.extname(base).toLowerCase()}`;
    const targetPath = path.join(UPLOAD_DIR, targetName);

    await fs.copyFile(srcPath, targetPath);
    publicUrls.push(`${PUBLIC_UPLOAD_BASE}/${targetName}`);
  }

  return publicUrls;
}

function pickTagIdsForCategory(category: Category, tags: Tag[], offset: number): string[] {
  const normalizedName = category.name.toLowerCase();
  const tokens = normalizedName.split(/\s+/).filter((t) => t.length > 2);

  let matches = tags.filter((tag) => {
    const tagName = tag.name.toLowerCase();
    return tokens.some((token) => tagName.includes(token));
  });

  if (matches.length < 3) {
    const fallback = tags.slice(offset % tags.length, (offset % tags.length) + 3);
    const fallbackWrapped = [...fallback, ...tags].slice(0, 3);
    matches = [...matches, ...fallbackWrapped];
  }

  const unique: string[] = [];
  for (const match of matches) {
    if (!unique.includes(match.id)) unique.push(match.id);
    if (unique.length === 3) break;
  }

  return unique;
}

async function main() {
  const [videos, imagePaths, categories, tags, admin] = await Promise.all([
    readVideos(),
    collectImages(),
    prisma.category.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findFirst({ where: { role: "ADMIN" } }),
  ]);

  if (!admin) {
    throw new Error("No ADMIN user found. Please create an admin first.");
  }

  if (videos.length === 0) {
    throw new Error("No video links found in content/video/video.txt");
  }

  if (imagePaths.length === 0) {
    throw new Error("No images found in content directories.");
  }

  const imageUrls = await prepareUploadImages(imagePaths);

  let created = 0;
  let updated = 0;

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const imageUrl = imageUrls[i % imageUrls.length];
    const videoUrl = videos[i % videos.length];
    const hint = CATEGORY_KEYWORD_HINTS[category.slug] || "production readiness";
    const title = CATEGORY_TITLES[category.slug] || `${category.name} teams are scaling practical delivery`;
    const mainKeyword = `${category.name} ${hint} implementation`;
    const slug = `insight-${category.slug}-2026`;
    const sourceUrl = `https://www.ultimatecomputersoftware.com/permalink/${slug}`;
    const excerpt = buildExcerpt(category.name, hint);
    const body = buildBody({ title, categoryName: category.name, hint, imageUrl, videoUrl, sourceUrl });
    const tagIds = pickTagIdsForCategory(category, tags, i * 3);

    const existing = await prisma.article.findUnique({ where: { slug }, select: { id: true } });

    const article = await prisma.article.upsert({
      where: { slug },
      create: {
        title,
        slug,
        body,
        excerpt,
        mainKeyword,
        authorName: admin.name || "Admin",
        originalSourceUrl: sourceUrl,
        imageUrl,
        status: "PUBLISHED",
        publishedAt: new Date(),
        categoryId: category.id,
        userId: admin.id,
      },
      update: {
        title,
        body,
        excerpt,
        mainKeyword,
        authorName: admin.name || "Admin",
        originalSourceUrl: sourceUrl,
        imageUrl,
        status: "PUBLISHED",
        publishedAt: new Date(),
        categoryId: category.id,
        userId: admin.id,
      },
      select: { id: true, slug: true },
    });

    await prisma.articleTag.deleteMany({ where: { articleId: article.id } });
    if (tagIds.length > 0) {
      await prisma.articleTag.createMany({
        data: tagIds.map((tagId) => ({ articleId: article.id, tagId })),
        skipDuplicates: true,
      });
    }

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const counts = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      name: true,
      _count: {
        select: {
          articles: true,
        },
      },
    },
  });

  console.log(`Seeded category articles complete. Created: ${created}, Updated: ${updated}`);
  for (const row of counts) {
    console.log(`- ${row.name}: ${row._count.articles} total article(s)`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to seed category articles:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
