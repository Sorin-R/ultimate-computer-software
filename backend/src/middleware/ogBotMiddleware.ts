/**
 * OG bot middleware — serves crawlers a fully populated `<head>` so they
 * can read meta tags, OG/Twitter cards, canonical URLs, and JSON-LD without
 * executing JavaScript.
 *
 * High-level flow per request:
 *   1. Skip non-GET, API, asset, and clearly non-HTML requests immediately.
 *   2. If User-Agent is not a known crawler → call next() (real users get the
 *      untouched SPA from whatever serves the frontend).
 *   3. If User-Agent IS a crawler:
 *      a. Look up cached HTML for this path (LRU + TTL).
 *      b. On cache miss, load index.html, run `buildMetaForPath`, splice the
 *         generated tags into <head>, and cache the result.
 *   4. Send the enriched HTML with appropriate headers.
 *
 * Why this lives in Express and not the reverse proxy:
 *   - The data we inject (titles, descriptions, JSON-LD) comes straight from
 *     Prisma. Doing it at the edge would mean shipping our DB layer there.
 *   - We can hot-update meta logic without touching deploy infra.
 *
 * Why we don't intercept real users:
 *   - Adding a DB hit to every HTML page load would tank TTFB for cold caches.
 *   - The SPA already populates `<head>` client-side via react-helmet-async,
 *     so logged-in browsers get identical tags after hydration.
 */

import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { isBot } from "../utils/botDetection";
import { buildMetaForPath } from "../utils/metaTagBuilder";

/* ---------------------------------------------------------- configuration */

/** Absolute path to the built frontend's index.html. Defaults follow our
 *  repo layout (backend cwd is `backend/` at runtime) but can be overridden
 *  with FRONTEND_DIST in env for unusual deploy setups. */
const FRONTEND_DIST =
  process.env.FRONTEND_DIST ||
  path.resolve(process.cwd(), "..", "frontend", "dist");
const INDEX_HTML_PATH = path.join(FRONTEND_DIST, "index.html");

/** Cache TTL for rendered bot HTML. Crawlers re-fetch infrequently, so 1h is
 *  a sane balance between staleness and DB load. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Hard cap on cached entries to bound memory. LRU-style eviction by oldest
 *  insertion. */
const CACHE_MAX_ENTRIES = 500;

/** Paths that should never be intercepted — these are backend-handled or
 *  static assets and have nothing to do with HTML SPA routing. */
const SKIP_PATH_PREFIXES = [
  "/api/",
  "/uploads/",
  "/og/",
  "/rss/",
  "/embed/",
  "/assets/",
  "/icons/",
];

const SKIP_EXACT_PATHS = new Set([
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
  "/manifest.json",
  "/sw.js",
  "/favicon.svg",
  "/favicon.ico",
  "/logo.svg",
  "/logo-dark.svg",
]);

/** Common static-file suffixes — bail out for any of these. */
const STATIC_SUFFIXES = [
  ".js",
  ".css",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp4",
  ".webm",
  ".mp3",
  ".pdf",
  ".xml",
  ".txt",
  ".json",
];

/* ---------------------------------------------------------------- cache */

interface CacheEntry {
  html: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU order
  cache.delete(key);
  cache.set(key, entry);
  return entry.html;
}

function cacheSet(key: string, html: string): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Evict oldest entry (first insertion in Map iteration order).
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { html, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Exported so admin endpoints (or tests) can flush the cache after content
 *  changes if we ever want manual invalidation. */
export function clearOgCache(): void {
  cache.clear();
}

/* --------------------------------------------------------- index.html load */

let cachedIndexHtml: string | null = null;
let cachedIndexMtime = 0;

/** Read and memo-cache the frontend's index.html. Invalidate when the file's
 *  mtime changes (so a fresh build is picked up without restarting). Returns
 *  `null` if the file doesn't exist (e.g. during dev when only Vite is up). */
function loadIndexHtml(): string | null {
  try {
    const stat = fs.statSync(INDEX_HTML_PATH);
    if (cachedIndexHtml && stat.mtimeMs === cachedIndexMtime) {
      return cachedIndexHtml;
    }
    const contents = fs.readFileSync(INDEX_HTML_PATH, "utf8");
    cachedIndexHtml = contents;
    cachedIndexMtime = stat.mtimeMs;
    return contents;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------- HTML injection */

/** Splice generated `<title>` and `<head>` fragments into the index.html
 *  template. If the template already contains a `<title>`, replace it; the
 *  generated head fragment is inserted just before `</head>`. */
function injectMetaIntoHtml(template: string, title: string, headFragment: string): string {
  let out = template;

  // Replace or insert <title>
  const titleTag = `<title>${title.replace(/</g, "&lt;")}</title>`;
  if (/<title>[\s\S]*?<\/title>/i.test(out)) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, titleTag);
  } else {
    out = out.replace(/<head>/i, `<head>\n    ${titleTag}`);
  }

  // Insert head fragment before </head>
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `    ${headFragment}\n  </head>`);
  } else {
    // No </head>? Append at top as graceful fallback.
    out = `${headFragment}\n${out}`;
  }

  return out;
}

/* ------------------------------------------------------------- middleware */

export async function ogBotMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Only intercept GET requests; everything else is API / mutation.
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const reqPath = req.path;

  // 2. Skip clearly-not-HTML paths.
  if (SKIP_EXACT_PATHS.has(reqPath)) return next();
  if (SKIP_PATH_PREFIXES.some((prefix) => reqPath.startsWith(prefix))) return next();
  if (STATIC_SUFFIXES.some((suffix) => reqPath.toLowerCase().endsWith(suffix))) return next();

  // 3. Only intercept for known crawlers — real users get the SPA untouched.
  const ua = req.headers["user-agent"];
  if (!isBot(ua)) return next();

  // 4. Try cache first.
  const cacheKey = reqPath;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
    res.setHeader("X-OG-Cache", "HIT");
    res.send(cached);
    return;
  }

  // 5. Load index.html template. If unavailable (no build yet), bail to next().
  const template = loadIndexHtml();
  if (!template) {
    res.setHeader("X-OG-Cache", "MISS-NO-TEMPLATE");
    return next();
  }

  // 6. Build meta for this path. Any error here is non-fatal — we still serve
  //    the template so the crawler at least gets a valid HTML page.
  try {
    const meta = await buildMetaForPath(reqPath);
    const html = injectMetaIntoHtml(template, meta.title, meta.head);
    cacheSet(cacheKey, html);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
    res.setHeader("X-OG-Cache", "MISS");
    res.setHeader("X-OG-Page-Type", meta.pageType);
    res.send(html);
  } catch (err) {
    // Log but don't break the response — fall through to the unmodified SPA.
    console.error("[ogBotMiddleware] failed to build meta for", reqPath, err);
    res.setHeader("X-OG-Cache", "ERROR");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(template);
  }
}
