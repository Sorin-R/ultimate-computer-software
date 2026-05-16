/**
 * C6: OG image auto-generator.
 *
 * Generates a 1200x630 PNG share-card per article (title + author + category)
 * via SVG -> Sharp. Cached to disk under uploads/og/{slug}.png and invalidated
 * whenever the article's updatedAt is newer than the cached file's mtime.
 *
 * Served at /og/article/:slug.png (root level, not /api) so the URL embeds
 * cleanly into og:image meta tags that social crawlers fetch directly.
 */
import { Request, Response } from "express";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import prisma from "../config/db";
import { param } from "../utils/params";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const CACHE_DIR = path.join(process.cwd(), "uploads", "og");

// Ensure the cache directory exists at startup.
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Naive word-wrapping: greedily packs words onto lines without exceeding
 * `maxCharsPerLine` (rough char-width heuristic — good enough for OG cards
 * since we cap line count anyway).
 */
function wrapTitle(title: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        // Last line: cram remaining words and ellipsize if too long.
        const rest = words.slice(words.indexOf(word)).join(" ");
        if (rest.length > maxCharsPerLine) {
          lines.push(rest.slice(0, maxCharsPerLine - 1).trimEnd() + "…");
        } else {
          lines.push(rest);
        }
        return lines;
      }
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Builds the OG card SVG. Style matches the rest of the site:
 * - Off-white background (#f6f6f4)
 * - Brand red accent bar (#b5121b) on the left
 * - Georgia serif for the headline (matches article H1)
 * - Uppercase tracked sans for meta lines
 */
function buildOgSvg(opts: {
  title: string;
  authorName: string;
  categoryName: string;
}): string {
  // 26 chars/line at 68px Georgia bold keeps the longest line within
  // ~960px of usable width (1200 - 120 left margin - 120 right margin).
  const titleLines = wrapTitle(opts.title, 26, 4);
  const safeTitleLines = titleLines.map(escapeXml);
  const safeAuthor = escapeXml(opts.authorName);
  const safeCategory = escapeXml(opts.categoryName.toUpperCase());

  const titleStartY = 200;
  const lineHeight = 84;

  const titleTspans = safeTitleLines
    .map(
      (line, i) =>
        `<tspan x="120" y="${titleStartY + i * lineHeight}">${line}</tspan>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <!-- Background -->
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#f6f6f4"/>

  <!-- Brand accent bar -->
  <rect x="0" y="0" width="24" height="${OG_HEIGHT}" fill="#b5121b"/>

  <!-- Top brand line -->
  <text x="120" y="100" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3" fill="#111111">
    ULTIMATE COMPUTER SOFTWARE
  </text>

  <!-- Category badge background -->
  <rect x="120" y="130" width="${Math.max(140, safeCategory.length * 11 + 24)}" height="32" fill="#b5121b"/>
  <text x="${120 + 12}" y="152" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#ffffff">
    ${safeCategory}
  </text>

  <!-- Title -->
  <text font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="700" fill="#111111">
    ${titleTspans}
  </text>

  <!-- Bottom divider -->
  <rect x="120" y="${OG_HEIGHT - 110}" width="${OG_WIDTH - 240}" height="1" fill="#11111133"/>

  <!-- Byline -->
  <text x="120" y="${OG_HEIGHT - 60}" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#444444">
    By ${safeAuthor}
  </text>

  <!-- Domain -->
  <text x="${OG_WIDTH - 120}" y="${OG_HEIGHT - 60}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="600" letter-spacing="2" fill="#b5121b">
    ULTIMATECOMPUTERSOFTWARE.COM
  </text>
</svg>`;
}

async function renderPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * GET /og/article/:slug.png
 * Returns a freshly generated (or cached) 1200x630 PNG share card.
 */
export async function getArticleOgImage(req: Request, res: Response): Promise<void> {
  const rawSlug = param(req.params.slug);
  // Strip an accidental ".png" tail (in case the route is registered without it).
  const slug = rawSlug.replace(/\.png$/i, "");

  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      title: true,
      authorName: true,
      updatedAt: true,
      user: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  if (!article) {
    res.status(404).type("text/plain").send("Article not found");
    return;
  }

  const cachePath = path.join(CACHE_DIR, `${slug}.png`);
  let buffer: Buffer | null = null;

  // Use cached file if it's newer than the article's last update.
  try {
    const stat = await fs.promises.stat(cachePath);
    if (stat.mtime >= article.updatedAt) {
      buffer = await fs.promises.readFile(cachePath);
    }
  } catch {
    // Cache miss — fall through to render.
  }

  if (!buffer) {
    const svg = buildOgSvg({
      title: article.title,
      authorName: article.authorName || article.user?.name || "Editorial",
      categoryName: article.category?.name || "Technology",
    });
    buffer = await renderPng(svg);
    // Best-effort write — don't fail the request if disk is read-only.
    fs.promises.writeFile(cachePath, buffer).catch((err) => {
      console.warn("[og] failed to cache image:", err.message);
    });
  }

  res.setHeader("Content-Type", "image/png");
  // Allow CDNs / social crawlers to cache aggressively; bust via the
  // article URL (slug) when republished, since updatedAt invalidates above.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.setHeader("Content-Length", buffer.length.toString());
  res.send(buffer);
}
