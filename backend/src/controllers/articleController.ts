import { Request, Response } from "express";
import prisma from "../config/db";
import { sanitizeHtml, generateExcerpt } from "../utils/sanitize";
import { uniqueArticleSlug, uniqueCategorySlug } from "../utils/slug";
import { param } from "../utils/params";
import { updateStreakOnRead } from "./streakController";
import { checkAuthorBadges, checkArticleViralityBadges } from "../services/badgeService";
import { sendArticleSubmittedForReviewEmail } from "../utils/email";
import { queueArticleAudioGeneration } from "../services/articleAudioService";

type ArticleRatingStats = { average: number; count: number };
type SubmittedArticleReviewChange = {
  field: string;
  before: string | null;
  after: string | null;
  note?: string | null;
};

type SubmittedArticleReviewChanges = {
  baseVersion: number;
  baseCreatedAt: Date;
  submittedVersion: number | null;
  submittedCreatedAt: Date | null;
  changes: SubmittedArticleReviewChange[];
};

function compactReviewValue(value: unknown, max = 180): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function pushReviewChange(
  changes: SubmittedArticleReviewChange[],
  field: string,
  before: unknown,
  after: unknown,
  note?: string
): void {
  const beforeText = compactReviewValue(before);
  const afterText = compactReviewValue(after);
  if (beforeText === afterText && !note) return;
  changes.push({ field, before: beforeText, after: afterText, note: note || null });
}

function plainTextFromHtml(value: string | null | undefined): string {
  return (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(value: string): number {
  const text = plainTextFromHtml(value);
  return text ? text.split(" ").length : 0;
}

async function loadSubmittedArticleReviewChanges(article: {
  id: string;
  title: string;
  body: string;
  excerpt: string | null;
  status: string;
}): Promise<SubmittedArticleReviewChanges | null> {
  if (article.status !== "SUBMITTED") return null;

  const versions = await prisma.articleVersion.findMany({
    where: { articleId: article.id },
    orderBy: { version: "desc" },
    take: 2,
    select: { id: true, version: true, title: true, body: true, excerpt: true, createdAt: true },
  });

  if (versions.length === 0) return null;

  const latest = versions[0];
  const latestIsSubmittedVersion = latest.title === article.title && latest.body === article.body;
  const baseline = latestIsSubmittedVersion ? versions[1] : latest;

  if (!baseline) return null;

  const changes: SubmittedArticleReviewChange[] = [];
  pushReviewChange(changes, "Title", baseline.title, article.title);
  pushReviewChange(changes, "Excerpt", baseline.excerpt, article.excerpt);

  if (baseline.body !== article.body) {
    const beforeWords = countWords(baseline.body);
    const afterWords = countWords(article.body);
    pushReviewChange(
      changes,
      "Body",
      plainTextFromHtml(baseline.body),
      plainTextFromHtml(article.body),
      `content changed (${beforeWords} -> ${afterWords} words)`
    );
  }

  if (changes.length === 0) return null;

  return {
    baseVersion: baseline.version,
    baseCreatedAt: baseline.createdAt,
    submittedVersion: latestIsSubmittedVersion ? latest.version : null,
    submittedCreatedAt: latestIsSubmittedVersion ? latest.createdAt : null,
    changes,
  };
}

async function loadArticleStats(articleIds: string[]): Promise<{
  viewsByArticleId: Map<string, number>;
  ratingsByArticleId: Map<string, ArticleRatingStats>;
}> {
  if (articleIds.length === 0) {
    return {
      viewsByArticleId: new Map(),
      ratingsByArticleId: new Map(),
    };
  }

  const [viewsAgg, ratingsAgg] = await Promise.all([
    prisma.articleView.groupBy({
      by: ["articleId"],
      where: { articleId: { in: articleIds } },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["articleId"],
      where: { articleId: { in: articleIds } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  return {
    viewsByArticleId: new Map(viewsAgg.map((row) => [row.articleId, row._count._all])),
    ratingsByArticleId: new Map(
      ratingsAgg.map((row) => [
        row.articleId,
        {
          average: row._avg.rating ?? 0,
          count: row._count._all,
        },
      ])
    ),
  };
}

async function countDistinctUserViews(articleId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(DISTINCT "userId") AS count
    FROM "article_views"
    WHERE "articleId" = ${articleId}
      AND "userId" IS NOT NULL
  `;
  const rawCount = rows[0]?.count ?? 0;
  const parsed = typeof rawCount === "bigint" ? Number(rawCount) : Number(rawCount);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getPublishedArticles(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
  const search = (req.query.search as string) || "";

  // R5: Full-text search + filters
  const categorySlug = (req.query.category as string) || "";
  const tagSlug = (req.query.tag as string) || "";
  const authorId = (req.query.authorId as string) || "";
  const fromRaw = (req.query.from as string) || "";
  const toRaw = (req.query.to as string) || "";

  const where: Record<string, unknown> = { status: "PUBLISHED" };

  if (search) {
    // Search across title, body, excerpt, mainKeyword and authorName.
    where.OR = [
      { title:       { contains: search, mode: "insensitive" } },
      { body:        { contains: search, mode: "insensitive" } },
      { excerpt:     { contains: search, mode: "insensitive" } },
      { mainKeyword: { contains: search, mode: "insensitive" } },
      { authorName:  { contains: search, mode: "insensitive" } },
    ];
  }

  if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  if (tagSlug) {
    where.tags = { some: { tag: { slug: tagSlug } } };
  }

  if (authorId) {
    where.userId = authorId;
  }

  if (fromRaw || toRaw) {
    const range: Record<string, Date> = {};
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (!isNaN(from.getTime())) range.gte = from;
    if (!isNaN(to.getTime())) {
      // Make `to` inclusive to end of day.
      to.setUTCHours(23, 59, 59, 999);
      range.lte = to;
    }
    if (Object.keys(range).length > 0) where.publishedAt = range;
  }

  // Public listing can be cached briefly by browsers/CDNs.
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");

  const [articlesBase, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        authorName: true,
        imageUrl: true,
        audioUrl: true,
        audioStatus: true,
        publishedAt: true,
        createdAt: true,
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  const { viewsByArticleId, ratingsByArticleId } = await loadArticleStats(
    articlesBase.map((article) => article.id)
  );

  const articles = articlesBase.map((article) => {
    const rating = ratingsByArticleId.get(article.id);
      return {
        ...article,
        publishedAt: article.publishedAt ?? article.createdAt,
        rating: {
          average: rating?.average ?? 0,
          count: rating?.count ?? 0,
      },
      views: {
        totalViews: viewsByArticleId.get(article.id) ?? 0,
      },
    };
  });

  res.json({ articles, total, page, totalPages: Math.ceil(total / limit) });
}

export async function getArticleBySlug(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "MODERATOR";

  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      user: { select: { name: true, username: true } },
    },
  });

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  // Non-admins can only view published articles
  if (!isAdmin && article.status !== "PUBLISHED") {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const related = await prisma.article.findMany({
    where: {
      categoryId: article.categoryId,
      status: "PUBLISHED",
      id: { not: article.id },
    },
    orderBy: { publishedAt: "desc" },
    take: 4,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      authorName: true,
      imageUrl: true,
      audioUrl: true,
      audioStatus: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const allArticleIdsForStats = [article.id, ...related.map((item) => item.id)];
  const [{ viewsByArticleId, ratingsByArticleId }, uniqueViews] = await Promise.all([
    loadArticleStats(allArticleIdsForStats),
    countDistinctUserViews(article.id),
  ]);

  const relatedWithStats = related.map((rel) => {
    const relRating = ratingsByArticleId.get(rel.id);
    return {
      ...rel,
      publishedAt: rel.publishedAt ?? rel.createdAt,
      rating: {
        average: relRating?.average ?? 0,
        count: relRating?.count ?? 0,
      },
      views: {
        totalViews: viewsByArticleId.get(rel.id) ?? 0,
      },
    };
  });

  // Caller-relationship to the author. Lets the frontend render "Following"
  // vs "Follow" without an extra round-trip.
  const callerId = req.user?.userId ?? null;
  let isFollowingAuthor = false;
  if (callerId && callerId !== article.userId) {
    const sub = await prisma.subscription.findUnique({
      where: {
        subscriberId_creatorId: {
          subscriberId: callerId,
          creatorId: article.userId,
        },
      },
      select: { id: true },
    });
    isFollowingAuthor = !!sub;
  }

  const reviewChanges =
    isAdmin && article.status === "SUBMITTED"
      ? await loadSubmittedArticleReviewChanges(article)
      : null;

  const normalizedArticle = {
    ...article,
    publishedAt: article.publishedAt ?? article.createdAt,
    body: article.body,
    reviewChanges,
    rating: {
      average: ratingsByArticleId.get(article.id)?.average ?? 0,
      count: ratingsByArticleId.get(article.id)?.count ?? 0,
    },
    views: {
      totalViews: viewsByArticleId.get(article.id) ?? 0,
      uniqueViews,
    },
    isFollowingAuthor,
  };

  if (req.user) {
    res.setHeader("Cache-Control", "private, no-store");
  } else {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
  }

  res.json({ article: normalizedArticle, related: relatedWithStats });
}

export async function createArticle(req: Request, res: Response): Promise<void> {
  const { title, body, categoryId, authorName, originalSourceUrl, mainKeyword, tagIds, status, imageUrl,
    articleType, amaExpiresAt, isPinnedToHome } = req.body;
  const userId = req.user!.userId;
  const isAdmin = req.user?.role === "ADMIN";

  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedKeyword = typeof mainKeyword === "string" ? mainKeyword.trim() : "";
  const safeTitle = trimmedTitle || "Untitled Article";
  const safeBody = typeof body === "string" && body.trim() ? body : "<p></p>";
  const safeKeyword = trimmedKeyword || safeTitle;

  let resolvedCategoryId = typeof categoryId === "string" ? categoryId : "";
  let category = resolvedCategoryId
    ? await prisma.category.findUnique({ where: { id: resolvedCategoryId } })
    : null;

  if (!category) {
    if (!isAdmin) {
      res.status(400).json({ error: "Category not found" });
      return;
    }

    category = await prisma.category.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });

    if (!category) {
      const fallbackName = "General";
      const fallbackSlug = await uniqueCategorySlug(fallbackName);
      category = await prisma.category.create({
        data: { name: fallbackName, slug: fallbackSlug, status: "ACTIVE" },
      });
    }

    resolvedCategoryId = category.id;
  }

  const sanitizedBody = sanitizeHtml(safeBody);
  const excerpt = generateExcerpt(sanitizedBody);
  const slug = await uniqueArticleSlug(safeKeyword);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  // Determine status and scheduledAt (C2)
  let resolvedStatus: "DRAFT" | "SUBMITTED" | "SCHEDULED" = "DRAFT";
  let resolvedScheduledAt: Date | null = null;

  if (status === "SUBMITTED") {
    resolvedStatus = "SUBMITTED";
  } else if (status === "SCHEDULED" && req.body.scheduledAt) {
    const scheduled = new Date(req.body.scheduledAt);
    if (!isNaN(scheduled.getTime()) && scheduled > new Date()) {
      resolvedStatus = "SCHEDULED";
      resolvedScheduledAt = scheduled;
    }
  }

  // K3: Article type + AMA expiry
  const resolvedType = ["ARTICLE", "AMA", "DISCUSSION"].includes(articleType) ? articleType : "ARTICLE";
  let resolvedAmaExpiresAt: Date | null = null;
  if (resolvedType === "AMA" && amaExpiresAt) {
    const exp = new Date(amaExpiresAt);
    if (!isNaN(exp.getTime()) && exp > new Date()) resolvedAmaExpiresAt = exp;
  }
  const resolvedPinned = resolvedType === "AMA" && isAdmin && isPinnedToHome === true;

  const article = await prisma.article.create({
    data: {
      title: safeTitle,
      slug,
      body: sanitizedBody,
      excerpt,
      mainKeyword: safeKeyword,
      authorName: authorName || user?.name || "Anonymous",
      originalSourceUrl: originalSourceUrl || null,
      imageUrl: imageUrl || null,
      status: resolvedStatus,
      scheduledAt: resolvedScheduledAt,
      articleType: resolvedType,
      amaExpiresAt: resolvedAmaExpiresAt,
      isPinnedToHome: resolvedPinned,
      categoryId: resolvedCategoryId,
      userId,
      tags: tagIds?.length
        ? { create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: {
      category: { select: { name: true, slug: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });

  // C1: Save initial version snapshot
  await saveArticleVersion(article.id, safeTitle, sanitizedBody, excerpt);

  if (resolvedStatus === "SUBMITTED" && user?.email) {
    await sendArticleSubmittedForReviewEmail(user.email, user.name || "there", article.title);
  }

  res.status(201).json({ article });
}

export async function updateArticle(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const userId = req.user!.userId;
  const isAdmin = req.user?.role === "ADMIN";

  const existing = await prisma.article.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      tags: { select: { tagId: true, tag: { select: { name: true } } } },
    },
  });
  if (!existing) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  if (existing.userId !== userId && !isAdmin) {
    res.status(403).json({ error: "Not your article" });
    return;
  }

  const { title, body, categoryId, authorName, originalSourceUrl, mainKeyword, tagIds, status, imageUrl } =
    req.body;

  if (
    !isAdmin &&
    (existing.status === "PUBLISHED" || existing.status === "APPROVED") &&
    status !== "SUBMITTED"
  ) {
    res.status(400).json({
      error:
        "Published or approved articles can only be edited when submitting them back for review.",
    });
    return;
  }

  const data: Record<string, unknown> = {};
  if (title) data.title = title;
  if (body) {
    data.body = sanitizeHtml(body);
    data.excerpt = generateExcerpt(data.body as string);
  }
  if (title || body) {
    data.audioUrl = null;
    data.audioStatus = "NONE";
    data.audioGeneratedAt = null;
    data.audioError = null;
  }
  if (categoryId) data.categoryId = categoryId;
  if (authorName !== undefined) data.authorName = authorName;
  if (originalSourceUrl !== undefined) data.originalSourceUrl = originalSourceUrl || null;
  if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
  if (mainKeyword && mainKeyword !== existing.mainKeyword) {
    data.slug = await uniqueArticleSlug(mainKeyword);
    data.mainKeyword = mainKeyword;
  }
  if (status) {
    data.status = status;
    if (status === "SUBMITTED") {
      data.publishedAt = null;
    }
  }

  // C2: Handle scheduled publishing
  if (status === "SCHEDULED" && req.body.scheduledAt) {
    const scheduled = new Date(req.body.scheduledAt);
    if (!isNaN(scheduled.getTime()) && scheduled > new Date()) {
      data.status = "SCHEDULED";
      data.scheduledAt = scheduled;
    }
  } else if (status === "SUBMITTED") {
    data.scheduledAt = null;
  }

  if (tagIds) {
    await prisma.articleTag.deleteMany({ where: { articleId: id } });
  }

  if (
    status === "SUBMITTED" &&
    (existing.status === "PUBLISHED" || existing.status === "APPROVED") &&
    (title !== undefined || body !== undefined)
  ) {
    await saveArticleVersionIfChanged(
      existing.id,
      existing.title,
      existing.body,
      existing.excerpt ?? undefined
    );
  }

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...data,
      ...(tagIds
        ? { tags: { create: tagIds.map((tagId: string) => ({ tagId })) } }
        : {}),
    },
    include: {
      category: { select: { name: true, slug: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });

  // C1: Save version snapshot on every manual save
  if (data.body || data.title) {
    await saveArticleVersion(
      article.id,
      article.title,
      article.body,
      article.excerpt ?? undefined
    );
  }

  if (status === "SUBMITTED" && existing.status !== "SUBMITTED") {
    const owner = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { email: true, name: true },
    });

    if (owner?.email) {
      await sendArticleSubmittedForReviewEmail(owner.email, owner.name || "there", article.title);
    }
  }

  res.json({ article });
}

export async function deleteArticle(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const userId = req.user!.userId;

  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: "Not your article" });
    return;
  }

  await prisma.article.delete({ where: { id } });
  res.json({ message: "Article deleted" });
}

export async function getUserArticles(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const articles = await prisma.article.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      excerpt: true,
      authorName: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      category: { select: { name: true, slug: true } },
    },
  });

  res.json({ articles });
}

export async function getUserArticleById(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const userId = req.user!.userId;
  const isAdmin = req.user?.role === "ADMIN";

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      tags: { select: { tagId: true, tag: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (article.userId !== userId && !isAdmin) {
    res.status(403).json({ error: "Not your article" });
    return;
  }

  res.json({ article });
}

export async function recordArticleView(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const { timeSpentSeconds } = req.body;
  const userId = req.user?.userId || null;

  // Validate time spent
  if (!timeSpentSeconds || typeof timeSpentSeconds !== "number" || timeSpentSeconds < 3) {
    res.status(400).json({ error: "Minimum 3 seconds required" });
    return;
  }

  // Find article
  const article = await prisma.article.findUnique({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  // Determine time range based on seconds spent
  const minutes = Math.floor(timeSpentSeconds / 60);
  let timeRange = "0-1";
  if (minutes > 5) {
    timeRange = "5+";
  } else if (minutes > 1) {
    timeRange = "1-5";
  }

  // Duplicate-prevention rule:
  // For the same logged-in user and the same article, skip recording another
  // view if one was already created in the last 30 minutes. This stops a
  // refresh loop from inflating reading-history weights for personalisation.
  // (Anonymous users are not de-duplicated server-side; the frontend localStorage
  // helper does its own 30-minute throttle for them.)
  if (userId) {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const recent = await prisma.articleView.findFirst({
      where: { userId, articleId: article.id, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) {
      res.json({ recorded: false, reason: "duplicate_within_30min" });
      return;
    }
  }

  // Record view
  await prisma.articleView.create({
    data: {
      articleId: article.id,
      userId: userId,
      timeSpentSeconds: timeSpentSeconds,
      timeRange,
    },
  });

  // R4: Update streak + award any newly-earned badges (logged-in users only).
  let streak: { stats: any; newBadges: any[] } | undefined;
  if (userId) {
    try {
      streak = await updateStreakOnRead(userId);
    } catch (err) {
      console.error("[recordArticleView] streak update failed:", err);
    }
  }

  // K8: virality badges for the article's author (TRENDING / VIRAL).
  // Best-effort, never blocks the response.
  await checkArticleViralityBadges(article.id);

  res.json({
    recorded: true,
    streak: streak?.stats,
    newBadges: streak?.newBadges ?? [],
  });
}

export async function getArticleStats(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const requesterId = req.user!.userId;
  const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "MODERATOR";

  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (!isAdmin && article.userId !== requesterId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [totalViewsAgg, uniqueViewsCount] = await Promise.all([
    prisma.articleView.aggregate({
      where: { articleId: article.id },
      _count: { _all: true },
      _avg: { timeSpentSeconds: true },
    }),
    countDistinctUserViews(article.id),
  ]);

  // Time range distribution
  const timeDistribution = await prisma.articleView.groupBy({
    by: ["timeRange"],
    where: { articleId: article.id },
    _count: { id: true },
  });

  const averageSeconds = totalViewsAgg._avg.timeSpentSeconds || 0;
  const averageMinutes = Math.round(averageSeconds / 60 * 10) / 10; // Round to 1 decimal place

  const stats = {
    totalViews: totalViewsAgg._count._all,
    uniqueViews: uniqueViewsCount,
    averageTimeSeconds: Math.round(averageSeconds),
    averageTimeMinutes: averageMinutes,
    timeRanges: timeDistribution.map((d) => ({
      range: d.timeRange,
      count: d._count.id,
    })),
  };

  res.json(stats);
}

// ─── C1: Version History Helpers & Endpoints ─────────────────────────────────

const MAX_VERSIONS_PER_ARTICLE = 5;

/** Save a version snapshot and prune to MAX_VERSIONS_PER_ARTICLE. */
export async function saveArticleVersion(
  articleId: string,
  title: string,
  body: string,
  excerpt?: string
): Promise<void> {
  // Get the current max version number
  const last = await prisma.articleVersion.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (last?.version ?? 0) + 1;

  await prisma.articleVersion.create({
    data: { articleId, title, body, excerpt: excerpt ?? null, version: nextVersion },
  });

  // Prune: keep only the latest MAX_VERSIONS_PER_ARTICLE
  const all = await prisma.articleVersion.findMany({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (all.length > MAX_VERSIONS_PER_ARTICLE) {
    const toDelete = all.slice(MAX_VERSIONS_PER_ARTICLE).map((v) => v.id);
    await prisma.articleVersion.deleteMany({ where: { id: { in: toDelete } } });
  }
}

async function saveArticleVersionIfChanged(
  articleId: string,
  title: string,
  body: string,
  excerpt?: string
): Promise<void> {
  const latest = await prisma.articleVersion.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { title: true, body: true },
  });

  if (latest?.title === title && latest.body === body) return;
  await saveArticleVersion(articleId, title, body, excerpt);
}

/** GET /api/articles/:id/versions — list saved versions for the owner. */
export async function listArticleVersions(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const userId = req.user!.userId;

  const article = await prisma.article.findUnique({ where: { id }, select: { userId: true } });
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }
  if (article.userId !== userId && req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const versions = await prisma.articleVersion.findMany({
    where: { articleId: id },
    orderBy: { version: "desc" },
    select: { id: true, version: true, title: true, excerpt: true, createdAt: true },
  });

  res.json({ versions });
}

/** GET /api/articles/:id/versions/:versionId — fetch full body of one version. */
export async function getArticleVersion(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const versionId = param(req.params.versionId);
  const userId = req.user!.userId;

  const article = await prisma.article.findUnique({ where: { id }, select: { userId: true } });
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }
  if (article.userId !== userId && req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const version = await prisma.articleVersion.findUnique({
    where: { id: versionId },
    select: { id: true, version: true, title: true, body: true, excerpt: true, createdAt: true },
  });
  if (!version) { res.status(404).json({ error: "Version not found" }); return; }

  res.json({ version });
}

// ─── C2: Scheduled Publishing (called by cron job) ───────────────────────────

/** Publish all SCHEDULED articles whose scheduledAt is in the past. */
export async function publishScheduledArticles(): Promise<void> {
  const now = new Date();
  const due = await prisma.article.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
  });

  if (due.length === 0) return;

  // Re-fetch with author/audio source fields so post-publish side effects can run.
  const dueWithAuthor = await prisma.article.findMany({
    where: { id: { in: due.map((a) => a.id) } },
    select: { id: true, title: true, body: true, userId: true },
  });

  await prisma.article.updateMany({
    where: { id: { in: due.map((a) => a.id) } },
    data: { status: "PUBLISHED", publishedAt: now },
  });

  // K8: best-effort author-milestone badges for each unique author.
  const authorIds = Array.from(new Set(dueWithAuthor.map((a) => a.userId)));
  for (const uid of authorIds) {
    await checkAuthorBadges(uid);
  }

  for (const article of dueWithAuthor) {
    queueArticleAudioGeneration(article);
  }

  console.log(`[cron] Published ${due.length} scheduled article(s) at ${now.toISOString()}`);
}

// ─── C3: Article Series Endpoints ────────────────────────────────────────────

/** GET /api/series — list the caller's series. */
export async function listMySeries(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const series = await prisma.articleSeries.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        orderBy: { position: "asc" },
        include: {
          article: { select: { id: true, title: true, slug: true, status: true } },
        },
      },
    },
  });
  res.json({ series });
}

/** POST /api/series — create a new series. */
export async function createSeries(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { title, description } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "Title is required" }); return; }

  const slug = await uniqueArticleSlug(title);
  const series = await prisma.articleSeries.create({
    data: { title: title.trim(), slug, description: description?.trim() || null, userId },
  });
  res.status(201).json({ series });
}

/** PUT /api/series/:id — update series details. */
export async function updateSeries(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const userId = req.user!.userId;
  const existing = await prisma.articleSeries.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Series not found" }); return;
  }
  const { title, description, memberIds } = req.body;
  const data: Record<string, unknown> = {};
  if (title) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;

  const series = await prisma.articleSeries.update({
    where: { id },
    data,
    include: { members: { orderBy: { position: "asc" } } },
  });

  // Re-order members if provided
  if (Array.isArray(memberIds)) {
    await prisma.articleSeriesMember.deleteMany({ where: { seriesId: id } });
    await prisma.articleSeriesMember.createMany({
      data: memberIds.map((articleId: string, idx: number) => ({
        seriesId: id,
        articleId,
        position: idx + 1,
      })),
      skipDuplicates: true,
    });
  }

  res.json({ series });
}

/** DELETE /api/series/:id */
export async function deleteSeries(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const userId = req.user!.userId;
  const existing = await prisma.articleSeries.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Series not found" }); return;
  }
  await prisma.articleSeries.delete({ where: { id } });
  res.json({ message: "Series deleted" });
}

/** GET /api/series/:id — public: get a series with all members. */
export async function getSeriesById(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const series = await prisma.articleSeries.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { position: "asc" },
        include: {
          article: {
            select: {
              id: true, title: true, slug: true, excerpt: true,
              status: true, publishedAt: true, imageUrl: true,
            },
          },
        },
      },
      user: { select: { id: true, name: true } },
    },
  });
  if (!series) { res.status(404).json({ error: "Series not found" }); return; }
  res.json({ series });
}

/** GET /api/articles/me/history — articles the current user has viewed,
 *  ordered newest-view first. Groups duplicate views so each article appears
 *  once (the most recent view time is returned).
 */
export async function getMyHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));

  // Fetch distinct articleIds ordered by most-recent view, paginated.
  const viewRows = await prisma.articleView.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { articleId: true, createdAt: true, timeRange: true },
  });

  // De-duplicate: keep the first (most recent) occurrence per articleId.
  const seen = new Set<string>();
  const unique: { articleId: string; viewedAt: Date; timeRange: string }[] = [];
  for (const row of viewRows) {
    if (!seen.has(row.articleId)) {
      seen.add(row.articleId);
      unique.push({ articleId: row.articleId, viewedAt: row.createdAt, timeRange: row.timeRange });
    }
  }

  const total = unique.length;
  const page_items = unique.slice((page - 1) * limit, page * limit);

  // Fetch article details for this page.
  const articleIds = page_items.map((r) => r.articleId);
  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds }, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      authorName: true,
      imageUrl: true,
      audioUrl: true,
      audioStatus: true,
      publishedAt: true,
      category: { select: { name: true, slug: true } },
    },
  });

  // Re-order to match page_items order (DB returns in arbitrary order).
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const history = page_items
    .map((r) => {
      const art = articleMap.get(r.articleId);
      if (!art) return null;
      return { ...art, viewedAt: r.viewedAt, timeRange: r.timeRange };
    })
    .filter(Boolean);

  res.json({
    history,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ─── R5: Search facets ────────────────────────────────────────────────────────

/**
 * GET /api/articles/search/facets
 * Returns category list, tag list, and top authors so the search page can
 * render filter chips without making 3 separate calls.
 */
export async function getSearchFacets(_req: Request, res: Response): Promise<void> {
  const [categories, tags, authors] = await Promise.all([
    prisma.category.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, slug: true, _count: { select: { articles: { where: { status: "PUBLISHED" } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      select: {
        id: true, name: true, slug: true,
        _count: { select: { articles: true } },
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    // Top 30 authors by published article count.
    prisma.user.findMany({
      where: { articles: { some: { status: "PUBLISHED" } } },
      select: {
        id: true, name: true, isVerified: true,
        _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
      },
      orderBy: { articles: { _count: "desc" } },
      take: 30,
    }),
  ]);

  res.json({
    categories: categories.map((c) => ({
      id: c.id, name: c.name, slug: c.slug, articleCount: c._count.articles,
    })),
    tags: tags
      .filter((t) => t._count.articles > 0)
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug, articleCount: t._count.articles })),
    authors: authors.map((a) => ({
      id: a.id, name: a.name, isVerified: a.isVerified, articleCount: a._count.articles,
    })),
  });
}

// ─── K3: AMA (Ask Me Anything) ────────────────────────────────────────────────

/**
 * GET /api/articles/amas — list active AMA threads.
 * An AMA is "active" when it is PUBLISHED and has not expired yet (or has no
 * expiry). Pinned AMAs appear first.
 */
export async function getActiveAmas(req: Request, res: Response): Promise<void> {
  const now = new Date();
  const amas = await prisma.article.findMany({
    where: {
      articleType: "AMA",
      status: "PUBLISHED",
      OR: [{ amaExpiresAt: null }, { amaExpiresAt: { gte: now } }],
    },
    orderBy: [{ isPinnedToHome: "desc" }, { publishedAt: "desc" }],
    take: 10,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      authorName: true,
      imageUrl: true,
      publishedAt: true,
      amaExpiresAt: true,
      isPinnedToHome: true,
      userId: true,
      user: { select: { id: true, name: true, isVerified: true } },
      category: { select: { name: true, slug: true } },
      _count: { select: { comments: true } },
    },
  });

  res.json({
    amas: amas.map((a) => ({
      ...a,
      commentCount: a._count.comments,
      isExpired: a.amaExpiresAt ? a.amaExpiresAt < now : false,
    })),
  });
}
