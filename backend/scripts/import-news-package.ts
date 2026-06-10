import "dotenv/config";
import { ArticleStatus, PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { generateExcerpt, sanitizeHtml } from "../dist/utils/sanitize";
import { uploadToR2, PUBLIC_URL } from "../dist/services/r2Service";

const prisma = new PrismaClient();

type ParsedPackage = {
  packageDir: string;
  packageSlug: string;
  title: string;
  articleMarkdown: string;
  mainKeyword: string;
  secondaryKeywords: string[];
  sourceUrls: string[];
  videoUrl: string | null;
  imagePaths: string[];
};

type CliOptions = {
  packageDir: string;
  dryRun: boolean;
  status: ArticleStatus;
  authorEmail: string | null;
  categorySlug: string;
  imageSourceUrl: string | null;   // attribution/source link for featured image
  featuredImageUrl: string | null; // external embed URL — skips R2 upload for featured image
};

const DEFAULT_AUTHOR_EMAIL = "admin@ultimatecomputersoftware.com";
const DEFAULT_CATEGORY_SLUG = "artificial-intelligence";

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readOption(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }

  return null;
}

function readPositionalPackage(args: string[]): string | null {
  const flagsWithValues = new Set([
    "--package", "--status", "--author-email", "--category-slug",
    "--image-source-url", "--featured-image-url",
  ]);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (flagsWithValues.has(arg)) {
      index++;
      continue;
    }
    if (arg.startsWith("--")) continue;
    return arg;
  }

  return null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBackendRoot(): Promise<string> {
  const cwd = path.resolve(process.cwd());
  if (path.basename(cwd) === "backend" && (await pathExists(path.join(cwd, "package.json")))) {
    return cwd;
  }

  const nestedBackend = path.join(cwd, "backend");
  if (await pathExists(path.join(nestedBackend, "package.json"))) {
    return nestedBackend;
  }

  throw new Error("Run this script from the project root or backend directory.");
}

async function parseCliOptions(backendRoot: string): Promise<CliOptions> {
  const args = process.argv.slice(2);
  const positionalPackage = readPositionalPackage(args);
  const packageArg = readOption(args, "--package") || positionalPackage;
  const defaultPackageDir = path.resolve(backendRoot, "../../../../news-aget/gemini-intelligence");
  const statusRaw = readOption(args, "--status") || ArticleStatus.PUBLISHED;
  const validStatuses = new Set<ArticleStatus>([
    ArticleStatus.DRAFT,
    ArticleStatus.SUBMITTED,
    ArticleStatus.PUBLISHED,
  ]);

  if (!validStatuses.has(statusRaw as ArticleStatus)) {
    throw new Error("--status must be one of DRAFT, SUBMITTED, or PUBLISHED.");
  }

  return {
    packageDir: path.resolve(packageArg || defaultPackageDir),
    dryRun: args.includes("--dry-run"),
    status: statusRaw as ArticleStatus,
    authorEmail: readOption(args, "--author-email") || DEFAULT_AUTHOR_EMAIL,
    categorySlug: readOption(args, "--category-slug") || DEFAULT_CATEGORY_SLUG,
    imageSourceUrl: readOption(args, "--image-source-url") || null,
    featuredImageUrl: readOption(args, "--featured-image-url") || null,
  };
}

function extractMarkdownTitle(markdown: string): string {
  const titleLine = markdown.split(/\r?\n/).find((line) => /^#\s+/.test(line.trim()));
  return titleLine?.replace(/^#\s+/, "").trim() || "Untitled Article";
}

function getMarkdownBodyWithoutTitle(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const firstTitleIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));
  if (firstTitleIndex === -1) return markdown.trim();
  return [...lines.slice(0, firstTitleIndex), ...lines.slice(firstTitleIndex + 1)].join("\n").trim();
}

function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return "";

  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line.trim())) break;
    collected.push(line);
  }

  return collected.join("\n").trim();
}

function extractKeywords(keywordsMarkdown: string): {
  mainKeyword: string;
  secondaryKeywords: string[];
  sourceUrls: string[];
} {
  const mainSection = extractSection(keywordsMarkdown, "Main Keyword");
  const secondarySection = extractSection(keywordsMarkdown, "Secondary Keywords");
  const mainKeyword =
    mainSection
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#")) || "Technology News";

  const secondaryKeywords = secondarySection
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\.\s*/, "").replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

  const sourceUrls = Array.from(keywordsMarkdown.matchAll(/https?:\/\/\S+/g)).map((match) =>
    match[0].replace(/[),.]+$/, "")
  );

  return { mainKeyword, secondaryKeywords, sourceUrls };
}

function extractFirstUrl(markdown: string): string | null {
  return markdown.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.]+$/, "") || null;
}

async function parsePackage(packageDir: string): Promise<ParsedPackage> {
  const articlePath = path.join(packageDir, "article.md");
  const keywordsPath = path.join(packageDir, "keywords.md");
  const videoPath = path.join(packageDir, "video.md");
  const imageDir = path.join(packageDir, "img");

  // img/ is optional — embed-only articles won't have it
  const imageDirExists = await pathExists(imageDir);
  let imageEntries: { isFile(): boolean; name: string }[] = [];
  if (imageDirExists) {
    imageEntries = await fs.readdir(imageDir, { withFileTypes: true }) as any;
  }

  const [articleMarkdown, keywordsMarkdown, videoMarkdown] = await Promise.all([
    fs.readFile(articlePath, "utf8"),
    fs.readFile(keywordsPath, "utf8"),
    fs.readFile(videoPath, "utf8"),
  ]);

  const imagePaths = imageEntries
    .filter((entry: any) => entry.isFile() && /\.(jpe?g|png|webp|gif)$/i.test(entry.name))
    .map((entry: any) => path.join(imageDir, entry.name))
    .sort();

  const { mainKeyword, secondaryKeywords, sourceUrls } = extractKeywords(keywordsMarkdown);

  return {
    packageDir,
    packageSlug: createSlug(path.basename(packageDir)),
    title: extractMarkdownTitle(articleMarkdown),
    articleMarkdown,
    mainKeyword,
    secondaryKeywords,
    sourceUrls,
    videoUrl: extractFirstUrl(videoMarkdown),
    imagePaths,
  };
}

function pipeTableToHtml(markdown: string): string {
  const lines = markdown.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return `<p>${escapeHtml(markdown.trim())}</p>`;

  const parseRow = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  // First line is header, second is separator, rest are data
  const headerCells = parseRow(lines[0]);
  const bodyLines = lines.slice(2);

  const thead = `<thead><tr>${headerCells
    .map((cell) => `<th>${escapeHtml(cell)}</th>`)
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${bodyLines
    .map(
      (line) =>
        `<tr>${parseRow(line)
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join("")}</tr>`
    )
    .join("")}</tbody>`;

  return `<table>${thead}${tbody}</table>`;
}

/**
 * Extract key terms/phrases from article body for a default table
 */
function extractKeyPoints(html: string): string[] {
  // Strip tags, get first 500 chars
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  // Find capitalized phrases (likely proper nouns: products, companies, features)
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  // Deduplicate and take top 4-6 unique meaningful phrases
  const seen = new Set<string>();
  return [...new Set(matches)]
    .filter((m) => m.length > 6 && !/^(The|This|That|With|From|When|They|Their|These|Those|About|After|While|Since)$/i.test(m))
    .slice(0, 6);
}

/**
 * Generate a default "Key Points" table when article has no table
 */
function generateDefaultTable(title: string, keyPoints: string[]): string {
  const rows = keyPoints.length > 0
    ? keyPoints.map((p) => `<tr><td>${escapeHtml(p)}</td></tr>`).join("")
    : `<tr><td>${escapeHtml(title.slice(0, 80))}</td></tr>`;
  return `<table><thead><tr><th>Key Points</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * Insert table after the second paragraph (intro section)
 */
function insertTableAfterIntro(html: string, table: string): string {
  const parts = html.split(/(<\/p>)/i);
  // Find position after 2nd </p> (end of intro paragraph)
  let count = 0;
  let insertAt = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "</p>") {
      count++;
      if (count === 2) {
        insertAt = i + 1; // right after the 2nd </p>
        break;
      }
    }
  }
  if (insertAt === 0) {
    // Fallback: insert after <article> tag
    return html.replace(/(<article>)/i, `$1\n${table}\n`);
  }
  parts.splice(insertAt, 0, `\n${table}\n`);
  return parts.join("");
}

function markdownChunkToHtml(chunk: string): string {
  const trimmed = chunk.trim();

  // Pass chunks that contain or are HTML tables through unescaped
  if (/<table\b[\s\S]*?<\/table>/i.test(trimmed)) {
    return trimmed;
  }
  if (/^<img\b[^>]*\/?>\s*$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^<figure\b[\s\S]*?<\/figure>\s*$/i.test(trimmed)) {
    return trimmed;
  }

  // Convert markdown pipe-style tables to HTML tables
  if (/\|.*\|/.test(trimmed) && /\|\s*[-:]+\s*\|/.test(trimmed)) {
    return pipeTableToHtml(trimmed);
  }

  if (/^###\s+/m.test(trimmed)) {
    return `<h3>${escapeHtml(trimmed.replace(/^###\s+/, ""))}</h3>`;
  }

  if (/^##\s+/m.test(trimmed)) {
    return `<h2>${escapeHtml(trimmed.replace(/^##\s+/, ""))}</h2>`;
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
    return `<ul>${lines
      .map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`)
      .join("")}</ul>`;
  }

  if (lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line))) {
    return `<ol>${lines
      .map((line) => `<li>${escapeHtml(line.replace(/^\d+\.\s+/, ""))}</li>`)
      .join("")}</ol>`;
  }

  return `<p>${escapeHtml(lines.join(" "))}</p>`;
}

function markdownToBlocks(markdown: string): string[] {
  const body = getMarkdownBodyWithoutTitle(markdown);

  // Protect HTML tables AND markdown pipe tables from chunk splitting
  const protected_: string[] = [];

  let guarded = body.replace(/<table\b[\s\S]*?<\/table>/gi, (match) => {
    protected_.push(match);
    return `__BLOCK_${protected_.length - 1}__`;
  });

  // Protect pipe tables: consecutive lines containing | and separator line
  guarded = guarded.replace(
    /(?:^[|].*[|]\s*$\n?)+/gm,
    (match) => {
      // Only protect if it contains a separator row (---+---)
      if (/\|\s*[-:]+\s*\|/.test(match)) {
        protected_.push(match.trim());
        return `__BLOCK_${protected_.length - 1}__\n`;
      }
      return match;
    }
  );

  const chunks = guarded.split(/\n\s*\n/g);

  return chunks
    .map((chunk) => {
      return chunk.replace(/__BLOCK_(\d+)__/g, (_, i) => protected_[parseInt(i)] || "");
    })
    .map(markdownChunkToHtml)
    .filter(Boolean);
}

function toYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const pathName = parsed.pathname;
    let videoId: string | null = null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      videoId = pathName.replace(/^\/+/, "").split("/")[0] || null;
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (pathName.startsWith("/embed/")) {
        videoId = pathName.replace("/embed/", "").split("/")[0] || null;
      } else if (pathName.startsWith("/shorts/")) {
        videoId = pathName.replace("/shorts/", "").split("/")[0] || null;
      } else {
        videoId = parsed.searchParams.get("v");
      }
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function imageBlock(imageUrl: string, alt: string, sourceUrl?: string | null): string {
  const img = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  if (sourceUrl) {
    const domain = (() => { try { return new URL(sourceUrl).hostname; } catch { return "source"; } })();
    return `<div class="article-media img-container">${img}<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="img-source-link">${escapeHtml(domain)}</a></div>`;
  }
  return `<p>${img}</p>`;
}

function videoBlock(videoUrl: string): string {
  const embedUrl = toYouTubeEmbedUrl(videoUrl);
  if (!embedUrl) {
    return `<section><h2>Related Video</h2><p><a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(videoUrl)}</a></p></section>`;
  }

  return [
    "<section>",
    "<h2>Related Video</h2>",
    `<iframe src="${escapeHtml(embedUrl)}" title="Related YouTube video" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="true"></iframe>`,
    "</section>",
  ].join("");
}

function composeArticleHtml(parsed: ParsedPackage, imageUrls: string[], imageSourceUrl?: string | null): string {
  const blocks = markdownToBlocks(parsed.articleMarkdown);
  const inlineImages = imageUrls.slice(1);
  const mediaByBlockIndex = new Map<number, string[]>();
  const queueMedia = (afterBlock: number, html: string) => {
    const existing = mediaByBlockIndex.get(afterBlock) || [];
    existing.push(html);
    mediaByBlockIndex.set(afterBlock, existing);
  };

  inlineImages.forEach((url, index) => {
    const afterBlock = [2, 7, 12][index] ?? blocks.length;
    queueMedia(afterBlock, imageBlock(url, `${parsed.title} image ${index + 2}`, imageSourceUrl));
  });

  if (parsed.videoUrl) {
    queueMedia(10, videoBlock(parsed.videoUrl));
  }

  const html: string[] = ["<article>"];
  blocks.forEach((block, index) => {
    html.push(block);
    const media = mediaByBlockIndex.get(index + 1);
    if (media) html.push(...media);
  });

  for (const [index, media] of mediaByBlockIndex.entries()) {
    if (index > blocks.length) html.push(...media);
  }

  html.push("</article>");
  return sanitizeHtml(html.join("\n"));
}

async function prepareImages(
  parsed: ParsedPackage,
  _backendRoot: string,
  dryRun: boolean
): Promise<string[]> {
  const imageUrls: string[] = [];
  const r2Prefix = `articles/${parsed.packageSlug}`;

  for (let index = 0; index < parsed.imagePaths.length; index++) {
    const sourcePath = parsed.imagePaths[index];
    const baseName = createSlug(path.basename(sourcePath, path.extname(sourcePath))) || `image-${index + 1}`;
    const targetName = `${String(index + 1).padStart(2, "0")}-${baseName}.webp`;
    const r2Key = `${r2Prefix}/${targetName}`;

    if (!dryRun) {
      const webpBuffer = await sharp(sourcePath)
        .resize(896, 504, { fit: "cover", position: "center" })
        .webp({ quality: 82 })
        .toBuffer();

      const { url } = await uploadToR2(r2Key, webpBuffer, "image/webp");
      imageUrls.push(url);
    } else {
      const url = PUBLIC_URL
        ? `${PUBLIC_URL}/${r2Key}`
        : `/api/media/${r2Key}`;
      imageUrls.push(url);
    }
  }

  return imageUrls;
}

async function findOrCreateCategory(categorySlug: string) {
  const existing = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (existing) return existing;

  const name = categorySlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return prisma.category.create({
    data: {
      name,
      slug: categorySlug,
      status: "ACTIVE",
      description: `Articles and analysis about ${name.toLowerCase()}.`,
    },
  });
}

async function findAuthor(authorEmail: string | null) {
  if (authorEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: authorEmail } });
    if (byEmail) return byEmail;
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (admin) return admin;

  throw new Error("No author found. Create an admin user first or pass --author-email user@example.com.");
}

async function upsertTags(keywordNames: string[], categoryId: string): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of keywordNames) {
    const normalizedName = name.trim();
    if (!normalizedName) continue;

    const slug = createSlug(normalizedName);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name: normalizedName, categoryId },
      create: { name: normalizedName, slug, categoryId },
      select: { id: true },
    });

    tagIds.push(tag.id);
  }

  return Array.from(new Set(tagIds));
}

async function saveArticleVersion(articleId: string, title: string, body: string, excerpt: string | null) {
  const latest = await prisma.articleVersion.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.articleVersion.create({
    data: {
      articleId,
      title,
      body,
      excerpt,
      version: (latest?.version ?? 0) + 1,
    },
  });
}

async function importPackage(options: CliOptions, backendRoot: string): Promise<void> {
  const parsed = await parsePackage(options.packageDir);
  const imageUrls = await prepareImages(parsed, backendRoot, options.dryRun);
  const body = composeArticleHtml(parsed, imageUrls, options.imageSourceUrl);

  // HARD ENFORCEMENT: Every article MUST have a table. If missing, inject one.
  let finalBody = body;
  if (!/<table\b/i.test(body)) {
    const title = parsed.title;
    const keyPoints = extractKeyPoints(body);
    const defaultTable = generateDefaultTable(title, keyPoints);
    // Insert after first two paragraphs (intro section)
    finalBody = insertTableAfterIntro(body, defaultTable);
    console.log("⚠️ No table found — injected default table");
  }
  const excerpt = generateExcerpt(finalBody);
  const slug = createSlug(parsed.title);
  const keywordNames = [parsed.mainKeyword, ...parsed.secondaryKeywords];

  // Featured image: use --featured-image-url if set (embed), otherwise R2 upload
  const featuredUrl = options.featuredImageUrl || imageUrls[0] || null;

  if (options.dryRun) {
    console.log("Dry run OK");
    console.log(`Package: ${parsed.packageDir}`);
    console.log(`Title: ${parsed.title}`);
    console.log(`Slug: ${slug}`);
    console.log(`Main keyword: ${parsed.mainKeyword}`);
    console.log(`Tags: ${keywordNames.join(", ")}`);
    console.log(`Images (R2): ${imageUrls.length}`);
    console.log(`Featured image: ${featuredUrl || "none"}`);
    console.log(`Image source: ${options.imageSourceUrl || "none"}`);
    console.log(`Video: ${parsed.videoUrl || "none"}`);
    console.log(`Status: ${options.status}`);
    console.log(`Body characters: ${finalBody.length}`);
    return;
  }

  const [category, author] = await Promise.all([
    findOrCreateCategory(options.categorySlug),
    findAuthor(options.authorEmail),
  ]);
  const tagIds = await upsertTags(keywordNames, category.id);
  const existing = await prisma.article.findUnique({ where: { slug }, select: { id: true, publishedAt: true } });
  const publishedAt =
    options.status === ArticleStatus.PUBLISHED ? existing?.publishedAt ?? new Date() : null;

  const articleData = {
    title: parsed.title,
    slug,
    body: finalBody,
    excerpt,
    mainKeyword: parsed.mainKeyword,
    authorName: author.name || "Admin",
    originalSourceUrl: parsed.sourceUrls[0] || parsed.videoUrl,
    imageUrl: featuredUrl,
    imageSourceUrl: options.imageSourceUrl || null,
    status: options.status,
    publishedAt,
    categoryId: category.id,
    userId: author.id,
  };

  const article = existing
    ? await prisma.article.update({
        where: { id: existing.id },
        data: articleData,
        select: { id: true, slug: true },
      })
    : await prisma.article.create({
        data: articleData,
        select: { id: true, slug: true },
      });

  await prisma.articleTag.deleteMany({ where: { articleId: article.id } });
  if (tagIds.length > 0) {
    await prisma.articleTag.createMany({
      data: tagIds.map((tagId) => ({ articleId: article.id, tagId })),
      skipDuplicates: true,
    });
  }
  await saveArticleVersion(article.id, parsed.title, finalBody, excerpt);

  console.log(`${existing ? "Updated" : "Created"} article: ${parsed.title}`);
  console.log(`Slug: ${article.slug}`);
  console.log(`Status: ${options.status}`);
  console.log(`Category: ${category.name}`);
  console.log(`Tags: ${keywordNames.join(", ")}`);
  console.log(`Images uploaded: ${imageUrls.length}`);
  console.log(`Featured image: ${featuredUrl || "none"}`);
  console.log(`Image source: ${options.imageSourceUrl || "none"}`);
}

async function main() {
  const backendRoot = await resolveBackendRoot();
  const options = await parseCliOptions(backendRoot);
  await importPackage(options, backendRoot);
}

main()
  .catch((error) => {
    console.error("Import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
