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

/* ---------------------------------------------------------------- L9: caches */

const SITEMAP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ROBOTS_TTL_MS = 60 * 60 * 1000;  // 1 hour

const sitemapCache = { value: "", expiresAt: 0 };
const robotsCache  = { value: "", expiresAt: 0 };

/* ---------------------------------------------------------------- sitemap */

export async function getSitemapXml(_req: Request, res: Response): Promise<void> {
  // L9: Serve from in-memory cache to avoid DB hit on every crawler request.
  if (sitemapCache.value && Date.now() < sitemapCache.expiresAt) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=900");
    res.send(sitemapCache.value);
    return;
  }

  const base = siteUrl();

  const [articles, categories, tags, authors] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true, publishedAt: true, createdAt: true },
    }),
    prisma.category.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true, createdAt: true },
    }),
    prisma.tag.findMany({
      select: { slug: true, updatedAt: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        articles: { some: { status: "PUBLISHED" } },
      },
      select: { id: true, username: true, updatedAt: true, createdAt: true },
    }),
  ]);

  const urls: Array<{ loc: string; lastmod: string; changefreq?: string; priority?: string }> = [
    // M10: Homepage updated to "daily" — hourly was too aggressive for this volume
    { loc: `${base}/`, lastmod: new Date().toISOString(), changefreq: "daily", priority: "1.0" },
    { loc: `${base}/latest`, lastmod: new Date().toISOString(), changefreq: "hourly", priority: "0.9" },
    { loc: `${base}/categories`, lastmod: new Date().toISOString(), changefreq: "daily", priority: "0.8" },
    { loc: `${base}/tags`, lastmod: new Date().toISOString(), changefreq: "daily", priority: "0.7" },
    { loc: `${base}/stats`, lastmod: new Date().toISOString(), changefreq: "hourly", priority: "0.6" },
    // H7: Additional public pages missing from the original sitemap
    { loc: `${base}/contact`, lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/privacy-policy`, lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/terms-of-service`, lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/reading-lists`, lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/requests`, lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.3" },
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

  for (const article of articles) {
    urls.push({
      loc: `${base}/${encodeURIComponent(article.slug)}`,
      lastmod: formatDateIso(article.publishedAt ?? article.updatedAt ?? article.createdAt),
      changefreq: "weekly",
      priority: "0.9",
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

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((entry) => {
      const fields = [
        `    <loc>${xmlEscape(entry.loc)}</loc>`,
        `    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`,
      ];
      if (entry.changefreq) fields.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority) fields.push(`    <priority>${entry.priority}</priority>`);
      return `  <url>\n${fields.join("\n")}\n  </url>`;
    })
    .join("\n")}\n</urlset>`;

  // L9: Cache the generated sitemap to avoid regenerating on every crawler hit.
  sitemapCache.value = body;
  sitemapCache.expiresAt = Date.now() + SITEMAP_TTL_MS;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.send(body);
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
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
