import { Request, Response } from "express";
import prisma from "../config/db";
import { env } from "../config/env";
import { stripHtml } from "../utils/sanitize";
import { param } from "../utils/params";

function siteUrl(): string {
  return (env.SITE_URL || "https://www.ultimatecomputersoftware.com").replace(/\/$/, "");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateIso(date: Date | null | undefined): string {
  if (!date) return new Date().toISOString();
  return date.toISOString();
}

function toExcerpt(value: string | null | undefined): string {
  if (!value) return "";
  return stripHtml(value).trim().slice(0, 300);
}

// Resolve an article image path to an absolute URL for image/news sitemaps.
// Mirrors the frontend rule: absolute URLs are kept; relative paths join the
// public site origin (the backend serves /uploads from that same origin).
function absoluteImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${siteUrl()}${path}`;
}

/* ---------------------------------------------------------------- L9: caches */

const SITEMAP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ROBOTS_TTL_MS = 60 * 60 * 1000;  // 1 hour

// Sitemaps.org caps a single sitemap at 50,000 URLs. Chunk articles well under
// that so the index can fan out to multiple article sitemaps as the site grows.
const ARTICLES_PER_SITEMAP = 10_000;
// Google News only wants articles from the last 2 days, capped at 1,000 URLs.
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;
const NEWS_MAX_ITEMS = 1_000;

type CacheEntry = { value: string; expiresAt: number };
const robotsCache: CacheEntry = { value: "", expiresAt: 0 };
const indexCache: CacheEntry = { value: "", expiresAt: 0 };
const pagesCache: CacheEntry = { value: "", expiresAt: 0 };
const newsCache: CacheEntry = { value: "", expiresAt: 0 };
// Articles are chunked, so cache each page separately keyed by page number.
const articlesPageCache = new Map<number, CacheEntry>();

function serveCached(res: Response, body: string, maxAgeSeconds: number): void {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSeconds}`);
  res.send(body);
}

type UrlEntry = {
  loc: string;
  lastmod: string;
  changefreq?: string;
  priority?: string;
  image?: { loc: string };
};

function renderUrlset(urls: UrlEntry[], extraNamespaces = ""): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extraNamespaces}>\n` +
    urls
      .map((entry) => {
        const fields = [
          `    <loc>${xmlEscape(entry.loc)}</loc>`,
          `    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`,
        ];
        if (entry.changefreq) fields.push(`    <changefreq>${entry.changefreq}</changefreq>`);
        if (entry.priority) fields.push(`    <priority>${entry.priority}</priority>`);
        if (entry.image) {
          fields.push(
            `    <image:image>\n      <image:loc>${xmlEscape(entry.image.loc)}</image:loc>\n    </image:image>`
          );
        }
        return `  <url>\n${fields.join("\n")}\n  </url>`;
      })
      .join("\n") +
    `\n</urlset>`
  );
}

/* ----------------------------------------------------------- sitemap index */

// Entry point at /sitemap.xml — a sitemap index that fans out to the page,
// article, and news child sitemaps. Search engines auto-discover it via
// robots.txt and crawl each child sitemap independently.
export async function getSitemapXml(_req: Request, res: Response): Promise<void> {
  if (indexCache.value && Date.now() < indexCache.expiresAt) {
    serveCached(res, indexCache.value, 900);
    return;
  }

  const base = siteUrl();
  const now = new Date().toISOString();

  const articleCount = await prisma.article.count({ where: { status: "PUBLISHED" } });
  const articlePages = Math.max(1, Math.ceil(articleCount / ARTICLES_PER_SITEMAP));

  const sitemaps = [`${base}/sitemap-pages.xml`, `${base}/sitemap-news.xml`];
  for (let page = 1; page <= articlePages; page++) {
    sitemaps.push(`${base}/sitemap-articles.xml?page=${page}`);
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemaps
      .map(
        (loc) =>
          `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`
      )
      .join("\n") +
    `\n</sitemapindex>`;

  indexCache.value = body;
  indexCache.expiresAt = Date.now() + SITEMAP_TTL_MS;
  serveCached(res, body, 900);
}

/* ---------------------------------------------------- pages + taxonomy map */

// Static pages plus category, tag, and author landing pages. Articles live in
// their own (chunked) sitemap so this stays small and changes rarely.
export async function getPagesSitemap(_req: Request, res: Response): Promise<void> {
  if (pagesCache.value && Date.now() < pagesCache.expiresAt) {
    serveCached(res, pagesCache.value, 900);
    return;
  }

  const base = siteUrl();
  const now = new Date().toISOString();

  const [categories, tags, authors] = await Promise.all([
    prisma.category.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true, createdAt: true },
    }),
    prisma.tag.findMany({ select: { slug: true, updatedAt: true, createdAt: true } }),
    prisma.user.findMany({
      where: { isActive: true, articles: { some: { status: "PUBLISHED" } } },
      select: { id: true, username: true, updatedAt: true, createdAt: true },
    }),
  ]);

  const urls: UrlEntry[] = [
    { loc: `${base}/`, lastmod: now, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/latest`, lastmod: now, changefreq: "hourly", priority: "0.9" },
    { loc: `${base}/categories`, lastmod: now, changefreq: "daily", priority: "0.8" },
    { loc: `${base}/tags`, lastmod: now, changefreq: "daily", priority: "0.7" },
    { loc: `${base}/stats`, lastmod: now, changefreq: "hourly", priority: "0.6" },
    { loc: `${base}/contact`, lastmod: now, changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/privacy-policy`, lastmod: now, changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/terms-of-service`, lastmod: now, changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/reading-lists`, lastmod: now, changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/requests`, lastmod: now, changefreq: "monthly", priority: "0.3" },
  ];

  for (const category of categories) {
    urls.push({
      loc: `${base}/category/${encodeURIComponent(category.slug)}`,
      lastmod: formatDateIso(category.updatedAt ?? category.createdAt),
      changefreq: "daily",
      priority: "0.7",
    });
  }
  for (const tag of tags) {
    urls.push({
      loc: `${base}/tag/${encodeURIComponent(tag.slug)}`,
      lastmod: formatDateIso(tag.updatedAt ?? tag.createdAt),
      changefreq: "daily",
      priority: "0.5",
    });
  }
  for (const author of authors) {
    const authorSlug = author.username ?? author.id;
    urls.push({
      loc: `${base}/author/${encodeURIComponent(authorSlug)}`,
      lastmod: formatDateIso(author.updatedAt ?? author.createdAt),
      changefreq: "daily",
      priority: "0.6",
    });
  }

  const body = renderUrlset(urls);
  pagesCache.value = body;
  pagesCache.expiresAt = Date.now() + SITEMAP_TTL_MS;
  serveCached(res, body, 900);
}

/* ------------------------------------------------------- articles sitemap */

// Dynamic, paginated sitemap of every published article. Each entry carries an
// <image:image> when the article has a main image so Google can index it.
// Page is selected via ?page=N (1-based) and matches the index fan-out.
export async function getArticlesSitemap(req: Request, res: Response): Promise<void> {
  const requested = parseInt(param(req.query.page as string | undefined), 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const cached = articlesPageCache.get(page);
  if (cached && Date.now() < cached.expiresAt) {
    serveCached(res, cached.value, 900);
    return;
  }

  const base = siteUrl();
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, imageUrl: true, updatedAt: true, publishedAt: true, createdAt: true },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    skip: (page - 1) * ARTICLES_PER_SITEMAP,
    take: ARTICLES_PER_SITEMAP,
  });

  const urls: UrlEntry[] = articles.map((article) => {
    const image = absoluteImageUrl(article.imageUrl);
    return {
      loc: `${base}/${encodeURIComponent(article.slug)}`,
      lastmod: formatDateIso(article.updatedAt ?? article.publishedAt ?? article.createdAt),
      changefreq: "weekly",
      priority: "0.9",
      ...(image ? { image: { loc: image } } : {}),
    };
  });

  const body = renderUrlset(
    urls,
    ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
  );
  articlesPageCache.set(page, { value: body, expiresAt: Date.now() + SITEMAP_TTL_MS });
  serveCached(res, body, 900);
}

/* ---------------------------------------------------- Google News sitemap */

// Google News sitemap: articles published within the last 48 hours (News
// ignores older entries), capped at 1,000 URLs. Uses the news: extension so
// each entry declares publication name, language, and publish date.
export async function getNewsSitemap(_req: Request, res: Response): Promise<void> {
  if (newsCache.value && Date.now() < newsCache.expiresAt) {
    serveCached(res, newsCache.value, 300);
    return;
  }

  const base = siteUrl();
  const since = new Date(Date.now() - NEWS_WINDOW_MS);
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: since } },
    select: { slug: true, title: true, publishedAt: true, createdAt: true },
    orderBy: { publishedAt: "desc" },
    take: NEWS_MAX_ITEMS,
  });

  const items = articles
    .map((article) => {
      const loc = `${base}/${encodeURIComponent(article.slug)}`;
      const pubDate = formatDateIso(article.publishedAt ?? article.createdAt);
      return (
        `  <url>\n` +
        `    <loc>${xmlEscape(loc)}</loc>\n` +
        `    <news:news>\n` +
        `      <news:publication>\n` +
        `        <news:name>${xmlEscape(env.SITE_NAME)}</news:name>\n` +
        `        <news:language>en</news:language>\n` +
        `      </news:publication>\n` +
        `      <news:publication_date>${xmlEscape(pubDate)}</news:publication_date>\n` +
        `      <news:title>${xmlEscape(article.title)}</news:title>\n` +
        `    </news:news>\n` +
        `  </url>`
      );
    })
    .join("\n");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n` +
    `${items}\n` +
    `</urlset>`;

  newsCache.value = body;
  // Shorter TTL: the news window slides quickly, so refresh more often.
  newsCache.expiresAt = Date.now() + 5 * 60 * 1000;
  serveCached(res, body, 300);
}

export async function getRobotsTxt(_req: Request, res: Response): Promise<void> {
  // L9: robots.txt is fully static — cache it for 1 hour.
  if (robotsCache.value && Date.now() < robotsCache.expiresAt) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(robotsCache.value);
    return;
  }

  const base = siteUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /reset-password",
    "Disallow: /api/admin",
    "Disallow: /api/me",
    "",
    `Sitemap: ${base}/sitemap.xml`,
  ].join("\n");

  robotsCache.value = body;
  robotsCache.expiresAt = Date.now() + ROBOTS_TTL_MS;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(body);
}

function rssXml(params: {
  title: string;
  description: string;
  feedUrl: string;
  siteLink: string;
  items: Array<{
    title: string;
    link: string;
    description: string;
    pubDate: string;
    // L7: updatedAt for feed readers that support <atom:updated>
    updatedAt?: string;
    author?: string;
    categories?: string[];
    guid?: string;
  }>;
}): string {
  const itemsXml = params.items
    .map((item) => {
      const categories = (item.categories ?? [])
        .map((category) => `<category>${xmlEscape(category)}</category>`)
        .join("");
      return `<item><title>${xmlEscape(item.title)}</title><link>${xmlEscape(item.link)}</link><guid>${xmlEscape(item.guid || item.link)}</guid><description>${xmlEscape(item.description)}</description><pubDate>${xmlEscape(item.pubDate)}</pubDate>${
        item.author ? `<author>${xmlEscape(item.author)}</author>` : ""
      }${categories}</item>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(
    params.title
  )}</title><description>${xmlEscape(params.description)}</description><link>${xmlEscape(
    params.siteLink
  )}</link><atom:link href="${xmlEscape(
    params.feedUrl
  )}" rel="self" type="application/rss+xml"/>${itemsXml}</channel></rss>`;
}

function resolveUserCandidate(slug: string): { id: string | null; name: string } {
  if (slug.startsWith("c") && slug.length >= 20) {
    return { id: slug, name: slug };
  }
  return { id: null, name: slug.replace(/-/g, " ") };
}

export async function getAuthorRss(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const base = siteUrl();
  const candidate = resolveUserCandidate(slug);

  const author = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        candidate.id ? { id: candidate.id } : { id: "__never__" },
        { name: { equals: candidate.name, mode: "insensitive" } },
      ],
      articles: { some: { status: "PUBLISHED" } },
    },
    select: { id: true, name: true },
  });

  if (!author) {
    res.status(404).json({ error: "Author not found" });
    return;
  }

  const articles = await prisma.article.findMany({
    where: { userId: author.id, status: "PUBLISHED" },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 30,
    include: {
      category: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const feedUrl = `${base}/rss/author/${encodeURIComponent(slug)}.xml`;
  const siteLink = `${base}/author/${encodeURIComponent(author.id)}`;

  const xml = rssXml({
    title: `${author.name} - RSS Feed`,
    description: `Latest published technology news by ${author.name}.`,
    feedUrl,
    siteLink,
    items: articles.map((article) => ({
      title: article.title,
      link: `${base}/${encodeURIComponent(article.slug)}`,
      guid: article.id,
      description: toExcerpt(article.excerpt || article.body),
      // L7: Use updatedAt when available so feed readers show freshness correctly
      pubDate: formatDateIso(article.updatedAt || article.publishedAt || article.createdAt),
      author: author.name,
      categories: [article.category.name, ...article.tags.map((value) => value.tag.name)],
    })),
  });

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.send(xml);
}

export async function getCategoryRss(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const base = siteUrl();

  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });

  if (!category || category.status !== "ACTIVE") {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const articles = await prisma.article.findMany({
    where: { categoryId: category.id, status: "PUBLISHED" },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 30,
    include: {
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const xml = rssXml({
    title: `${category.name} - RSS Feed`,
    description: `Latest published technology news in ${category.name}.`,
    feedUrl: `${base}/rss/category/${encodeURIComponent(slug)}.xml`,
    siteLink: `${base}/category/${encodeURIComponent(slug)}`,
    items: articles.map((article) => ({
      title: article.title,
      link: `${base}/${encodeURIComponent(article.slug)}`,
      guid: article.id,
      description: toExcerpt(article.excerpt || article.body),
      pubDate: formatDateIso(article.updatedAt || article.publishedAt || article.createdAt),
      author: article.authorName,
      categories: [category.name, ...article.tags.map((value) => value.tag.name)],
    })),
  });

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.send(xml);
}

export async function getTagRss(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const base = siteUrl();

  const tag = await prisma.tag.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      tags: { some: { tagId: tag.id } },
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 30,
    include: {
      category: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const xml = rssXml({
    title: `${tag.name} - RSS Feed`,
    description: `Latest published technology news tagged ${tag.name}.`,
    feedUrl: `${base}/rss/tag/${encodeURIComponent(slug)}.xml`,
    siteLink: `${base}/tag/${encodeURIComponent(slug)}`,
    items: articles.map((article) => ({
      title: article.title,
      link: `${base}/${encodeURIComponent(article.slug)}`,
      guid: article.id,
      description: toExcerpt(article.excerpt || article.body),
      pubDate: formatDateIso(article.updatedAt || article.publishedAt || article.createdAt),
      author: article.authorName,
      categories: [article.category.name, ...article.tags.map((value) => value.tag.name)],
    })),
  });

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.send(xml);
}
