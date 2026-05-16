/**
 * Meta-tag / JSON-LD builder used by the bot OG middleware.
 *
 * Given a request path, it identifies the page type (article, category, tag,
 * author, home, generic) and returns the HTML fragment that should be injected
 * into `<head>` so crawlers see proper title, description, OG/Twitter cards,
 * canonical URL, and JSON-LD structured data without executing JavaScript.
 *
 * All data lookups are read-only and use the same Prisma models as the public
 * API. Failures are non-fatal — we fall back to the generic site-wide meta so
 * crawlers always get *something*.
 */

import prisma from "../config/db";
import { env } from "../config/env";
import { stripHtml } from "./sanitize";

const SITE_NAME = "Ultimate Computer Software";
const DEFAULT_DESCRIPTION = "Your trusted source for worldwide technology news.";

function siteUrl(): string {
  return (env.SITE_URL || "https://www.ultimatecomputersoftware.com").replace(/\/$/, "");
}

/** Escape text for safe HTML attribute insertion (title, content="...", etc). */
function attr(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape `</script>` so embedded JSON-LD can't break out of its tag. */
function safeJsonLd(payload: unknown): string {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

/** Trim and dedupe whitespace; clamp to a sensible meta-description length. */
function shortDescription(value: string | null | undefined, max = 160): string {
  if (!value) return DEFAULT_DESCRIPTION;
  const clean = stripHtml(value).replace(/\s+/g, " ").trim();
  if (!clean) return DEFAULT_DESCRIPTION;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export interface MetaTagResult {
  /** HTML fragment inserted into <head>. Includes meta + link + script (JSON-LD) tags. */
  head: string;
  /** Optional <title> override; injected as `<title>...</title>` if present. */
  title: string;
  /** Whether this page type is private and should not be indexed. */
  noindex: boolean;
  /** Page-type label used for logging / cache analytics. */
  pageType: "article" | "category" | "tag" | "author" | "home" | "tags-list" | "categories-list" | "private" | "generic" | "not-found";
}

/* ------------------------------------------------------------------ helpers */

function baseTags(opts: {
  title: string;
  description: string;
  url: string;
  type?: string;
  imageUrl?: string;
  imageAlt?: string;
  noindex?: boolean;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}): string {
  const fullTitle = opts.title.includes(SITE_NAME) ? opts.title : `${opts.title} | ${SITE_NAME}`;
  const img = opts.imageUrl || `${siteUrl()}/og-default.png`;
  const imageAlt = opts.imageAlt || opts.description;
  const isArticle = opts.type === "article";
  const lines = [
    opts.noindex ? `<meta name="robots" content="noindex, nofollow" />` : "",
    `<meta name="description" content="${attr(opts.description)}" />`,
    opts.author ? `<meta name="author" content="${attr(opts.author)}" />` : "",
    `<link rel="canonical" href="${attr(opts.url)}" />`,
    `<meta property="og:title" content="${attr(fullTitle)}" />`,
    `<meta property="og:description" content="${attr(opts.description)}" />`,
    `<meta property="og:url" content="${attr(opts.url)}" />`,
    `<meta property="og:type" content="${attr(opts.type || "website")}" />`,
    `<meta property="og:image" content="${attr(img)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${attr(imageAlt)}" />`,
    `<meta property="og:site_name" content="${attr(SITE_NAME)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    isArticle && opts.publishedTime
      ? `<meta property="article:published_time" content="${attr(opts.publishedTime)}" />`
      : "",
    isArticle && opts.modifiedTime
      ? `<meta property="article:modified_time" content="${attr(opts.modifiedTime)}" />`
      : "",
    isArticle && opts.modifiedTime
      ? `<meta property="og:updated_time" content="${attr(opts.modifiedTime)}" />`
      : "",
    isArticle && opts.author ? `<meta property="article:author" content="${attr(opts.author)}" />` : "",
    isArticle && opts.section ? `<meta property="article:section" content="${attr(opts.section)}" />` : "",
    ...(isArticle ? (opts.tags || []).map((tag) => `<meta property="article:tag" content="${attr(tag)}" />`) : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${attr(fullTitle)}" />`,
    `<meta name="twitter:description" content="${attr(opts.description)}" />`,
    `<meta name="twitter:image" content="${attr(img)}" />`,
    `<meta name="twitter:image:alt" content="${attr(imageAlt)}" />`,
  ];
  return lines.filter(Boolean).join("\n    ");
}

/* ---------------------------------------------------------------- builders */

async function buildArticleMeta(slug: string): Promise<MetaTagResult | null> {
  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true } },
      user: { select: { name: true, username: true, id: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  if (!article || article.status !== "PUBLISHED") return null;

  const url = `${siteUrl()}/${encodeURIComponent(article.slug)}`;
  const description = shortDescription(article.excerpt || article.body);
  const ogImage = `${siteUrl()}/og/article/${encodeURIComponent(article.slug)}.png`;
  const authorSlug = article.user?.username || article.user?.id || article.userId;
  const publishedTime = article.publishedAt?.toISOString();
  const modifiedTime = article.updatedAt?.toISOString() || publishedTime;
  const articleTags = article.tags.map(({ tag }) => tag.name);

  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description,
    image: [ogImage],
    datePublished: article.publishedAt?.toISOString() || undefined,
    dateModified: article.updatedAt?.toISOString() || article.publishedAt?.toISOString() || undefined,
    author: {
      "@type": "Person",
      name: article.authorName,
      url: `${siteUrl()}/author/${encodeURIComponent(authorSlug)}`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl(),
      // H2: PNG logo required by Google Rich Results (600×60 max)
      logo: { "@type": "ImageObject", url: `${siteUrl()}/logo-google.png`, width: 600, height: 60 },
    },
    mainEntityOfPage: url,
    articleSection: article.category.name,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl()}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: article.category.name,
        item: `${siteUrl()}/category/${encodeURIComponent(article.category.slug)}`,
      },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ],
  };

  const head = [
    baseTags({
      title: article.title,
      description,
      url,
      type: "article",
      imageUrl: ogImage,
      imageAlt: article.title,
      author: article.authorName,
      publishedTime,
      modifiedTime,
      section: article.category.name,
      tags: articleTags,
    }),
    `<script type="application/ld+json">${safeJsonLd(newsArticleSchema)}</script>`,
    `<script type="application/ld+json">${safeJsonLd(breadcrumbSchema)}</script>`,
  ].join("\n    ");

  return {
    head,
    title: `${article.title} | ${SITE_NAME}`,
    noindex: false,
    pageType: "article",
  };
}

async function buildCategoryMeta(slug: string): Promise<MetaTagResult | null> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true, slug: true, description: true, status: true },
  });

  if (!category || category.status !== "ACTIVE") return null;

  const url = `${siteUrl()}/category/${encodeURIComponent(category.slug)}`;
  const description = category.description || `Latest ${category.name} news and articles.`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl()}/` },
      { "@type": "ListItem", position: 2, name: "Categories", item: `${siteUrl()}/categories` },
      { "@type": "ListItem", position: 3, name: category.name, item: url },
    ],
  };

  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} | ${SITE_NAME}`,
    description,
    url,
    breadcrumb: breadcrumbSchema,
  };

  const head = [
    baseTags({ title: category.name, description, url, type: "website" }),
    `<script type="application/ld+json">${safeJsonLd(breadcrumbSchema)}</script>`,
    `<script type="application/ld+json">${safeJsonLd(collectionPageSchema)}</script>`,
  ].join("\n    ");

  return {
    head,
    title: `${category.name} | ${SITE_NAME}`,
    noindex: false,
    pageType: "category",
  };
}

async function buildTagMeta(slug: string): Promise<MetaTagResult | null> {
  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { name: true, slug: true },
  });

  if (!tag) return null;

  const url = `${siteUrl()}/tag/${encodeURIComponent(tag.slug)}`;
  const description = `Browse all technology articles tagged #${tag.name}.`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl()}/` },
      { "@type": "ListItem", position: 2, name: "Tags", item: `${siteUrl()}/tags` },
      { "@type": "ListItem", position: 3, name: `#${tag.name}`, item: url },
    ],
  };

  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `#${tag.name} | ${SITE_NAME}`,
    description,
    url,
    breadcrumb: breadcrumbSchema,
  };

  const head = [
    baseTags({ title: `#${tag.name} Articles`, description, url, type: "website" }),
    `<script type="application/ld+json">${safeJsonLd(breadcrumbSchema)}</script>`,
    `<script type="application/ld+json">${safeJsonLd(collectionPageSchema)}</script>`,
  ].join("\n    ");

  return {
    head,
    title: `#${tag.name} Articles | ${SITE_NAME}`,
    noindex: false,
    pageType: "tag",
  };
}

async function buildAuthorMeta(idOrUsername: string): Promise<MetaTagResult | null> {
  const author = await prisma.user.findFirst({
    where: {
      OR: [{ id: idOrUsername }, { username: idOrUsername }],
      isActive: true,
    },
    select: { id: true, username: true, name: true, bio: true, avatarUrl: true },
  });

  if (!author) return null;

  const slugForUrl = author.username || author.id;
  const url = `${siteUrl()}/author/${encodeURIComponent(slugForUrl)}`;
  const description = author.bio
    ? shortDescription(author.bio)
    : `Articles by ${author.name} on ${SITE_NAME}.`;

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    url,
    image: author.avatarUrl || undefined,
    description,
  };

  const head = [
    baseTags({
      title: author.name,
      description,
      url,
      type: "profile",
      imageUrl: author.avatarUrl || undefined,
      author: author.name,
    }),
    `<script type="application/ld+json">${safeJsonLd(personSchema)}</script>`,
  ].join("\n    ");

  return {
    head,
    title: `${author.name} | ${SITE_NAME}`,
    noindex: false,
    pageType: "author",
  };
}

function buildHomeMeta(): MetaTagResult {
  const url = `${siteUrl()}/`;
  const description = DEFAULT_DESCRIPTION;

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl(),
    description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl()}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const head = [
    baseTags({ title: SITE_NAME, description, url, type: "website" }),
    `<script type="application/ld+json">${safeJsonLd(websiteSchema)}</script>`,
  ].join("\n    ");

  return { head, title: SITE_NAME, noindex: false, pageType: "home" };
}

function buildGenericMeta(path: string, opts?: { title?: string; description?: string; noindex?: boolean; pageType?: MetaTagResult["pageType"] }): MetaTagResult {
  const url = `${siteUrl()}${path}`;
  const title = opts?.title || SITE_NAME;
  const description = opts?.description || DEFAULT_DESCRIPTION;
  return {
    head: baseTags({ title, description, url, type: "website", noindex: opts?.noindex }),
    title: title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`,
    noindex: opts?.noindex || false,
    pageType: opts?.pageType || "generic",
  };
}

/* ------------------------------------------------------------------- router */

/**
 * Classify a request path and build the matching meta tags. Returns a result
 * even for unknown paths so callers can always inject *something* into <head>.
 *
 * Paths considered private (admin/dashboard/auth) get a noindex marker —
 * crawlers shouldn't index them even if they happen to follow a link.
 */
export async function buildMetaForPath(path: string): Promise<MetaTagResult> {
  const cleanPath = path.split("?")[0].split("#")[0];

  // Home / latest
  if (cleanPath === "/" || cleanPath === "/latest") {
    return buildHomeMeta();
  }

  // Categories listing
  if (cleanPath === "/categories") {
    return buildGenericMeta(cleanPath, {
      title: "Categories",
      description: "Browse all technology news categories.",
      pageType: "categories-list",
    });
  }

  // Tags listing
  if (cleanPath === "/tags") {
    return buildGenericMeta(cleanPath, {
      title: "Topics & Tags",
      description: "Browse all technology topics and tags.",
      pageType: "tags-list",
    });
  }

  // Search
  if (cleanPath === "/search") {
    return buildGenericMeta(cleanPath, {
      title: "Search Articles",
      description: "Search worldwide technology news.",
      pageType: "generic",
    });
  }

  // Private — never index
  if (
    cleanPath === "/login" ||
    cleanPath === "/register" ||
    cleanPath === "/reset-password" ||
    cleanPath.startsWith("/dashboard") ||
    cleanPath.startsWith("/admin")
  ) {
    return buildGenericMeta(cleanPath, {
      title: "Private",
      description: DEFAULT_DESCRIPTION,
      noindex: true,
      pageType: "private",
    });
  }

  // Category
  const categoryMatch = cleanPath.match(/^\/category\/([^/]+)\/?$/);
  if (categoryMatch) {
    const meta = await buildCategoryMeta(decodeURIComponent(categoryMatch[1]));
    return meta || { ...buildGenericMeta(cleanPath, { noindex: true }), pageType: "not-found" };
  }

  // Tag
  const tagMatch = cleanPath.match(/^\/tag\/([^/]+)\/?$/);
  if (tagMatch) {
    const meta = await buildTagMeta(decodeURIComponent(tagMatch[1]));
    return meta || { ...buildGenericMeta(cleanPath, { noindex: true }), pageType: "not-found" };
  }

  // Author (also covers /author/:slug/policy-compliance — strip suffix)
  const authorMatch = cleanPath.match(/^\/author\/([^/]+)(?:\/.*)?$/);
  if (authorMatch) {
    const meta = await buildAuthorMeta(decodeURIComponent(authorMatch[1]));
    return meta || { ...buildGenericMeta(cleanPath, { noindex: true }), pageType: "not-found" };
  }

  // Article (single-segment slug — must come last because it's the catch-all)
  const articleMatch = cleanPath.match(/^\/([^/]+)\/?$/);
  if (articleMatch) {
    const meta = await buildArticleMeta(decodeURIComponent(articleMatch[1]));
    if (meta) return meta;
  }

  // Fallback
  return buildGenericMeta(cleanPath);
}
