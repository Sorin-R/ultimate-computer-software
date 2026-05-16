import { Request, Response } from "express";
import prisma from "../config/db";

const VALID_SORTS = ["top_stories", "most_read", "most_rated", "highest_rating"] as const;
type StorySort = (typeof VALID_SORTS)[number];

type StoryArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioStatus: "NONE" | "PROCESSING" | "READY" | "FAILED";
  category: { name: string; slug: string };
  publishedAt: Date | null;
  createdAt: Date;
  publishedDate: Date;
  views: number;
  averageRating: number;
  ratingCount: number;
  topStoryScore: number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function resolveSort(sortRaw: unknown): StorySort {
  if (typeof sortRaw !== "string") return "top_stories";
  const normalized = sortRaw.toLowerCase() as StorySort;
  return VALID_SORTS.includes(normalized) ? normalized : "top_stories";
}

function toSafeFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function daysSince(date: Date, nowMs: number): number {
  const diffMs = nowMs - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return diffMs / MS_PER_DAY;
}

function compareDateDesc(a: StoryArticle, b: StoryArticle): number {
  return b.publishedDate.getTime() - a.publishedDate.getTime();
}

export async function getStories(req: Request, res: Response): Promise<void> {
  const sort = resolveSort(req.query.sort);

  // Pagination: page (1-based) and limit (capped to 50). Total page count is
  // computed from the full ranked list so the frontend knows when to stop
  // requesting more for infinite scroll.
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const [articlesBase, viewsAgg, ratingsAgg] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
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
      },
    }),
    prisma.articleView.groupBy({
      by: ["articleId"],
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["articleId"],
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const viewsByArticleId = new Map<string, number>(
    viewsAgg.map((row) => [row.articleId, toSafeFiniteNumber(row._count._all, 0)])
  );

  const ratingsByArticleId = new Map<string, { averageRating: number; ratingCount: number }>(
    ratingsAgg.map((row) => [
      row.articleId,
      {
        averageRating: toSafeFiniteNumber(row._avg.rating, 0),
        ratingCount: toSafeFiniteNumber(row._count._all, 0),
      },
    ])
  );

  const maxViews = Math.max(
    0,
    ...articlesBase.map((article) => viewsByArticleId.get(article.id) ?? 0)
  );

  const maxRatingCount = Math.max(
    0,
    ...articlesBase.map((article) => ratingsByArticleId.get(article.id)?.ratingCount ?? 0)
  );

  const nowMs = Date.now();

  const stories: StoryArticle[] = articlesBase.map((article) => {
    const ratingStats = ratingsByArticleId.get(article.id);

    const views = Math.max(0, viewsByArticleId.get(article.id) ?? 0);
    const averageRating = Math.max(0, ratingStats?.averageRating ?? 0);
    const ratingCount = Math.max(0, ratingStats?.ratingCount ?? 0);

    const publishedDate = article.publishedAt ?? article.createdAt;
    const ageInDays = daysSince(publishedDate, nowMs);

    const viewScore = maxViews > 0 ? views / maxViews : 0;
    const ratingScore = averageRating > 0 ? averageRating / 5 : 0;
    const ratingCountScore = maxRatingCount > 0 ? ratingCount / maxRatingCount : 0;
    const freshnessScore = 1 / (1 + ageInDays);

    const topStoryScore =
      viewScore * 0.4 +
      ratingScore * 0.25 +
      ratingCountScore * 0.2 +
      freshnessScore * 0.15;

    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      authorName: article.authorName,
      imageUrl: article.imageUrl,
      audioUrl: article.audioUrl,
      audioStatus: article.audioStatus,
      category: article.category,
      publishedAt: article.publishedAt ?? article.createdAt,
      createdAt: article.createdAt,
      publishedDate,
      views,
      averageRating,
      ratingCount,
      topStoryScore: toSafeFiniteNumber(topStoryScore, 0),
    };
  });

  const sorted = [...stories];

  if (sort === "most_read") {
    sorted.sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      return compareDateDesc(a, b);
    });
  } else if (sort === "most_rated") {
    sorted.sort((a, b) => {
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.views !== a.views) return b.views - a.views;
      return compareDateDesc(a, b);
    });
  } else if (sort === "highest_rating") {
    sorted.sort((a, b) => {
      const aHasMinimum = a.ratingCount >= 10 ? 1 : 0;
      const bHasMinimum = b.ratingCount >= 10 ? 1 : 0;

      if (bHasMinimum !== aHasMinimum) return bHasMinimum - aHasMinimum;
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      if (b.views !== a.views) return b.views - a.views;
      return compareDateDesc(a, b);
    });
  } else {
    sorted.sort((a, b) => {
      if (b.topStoryScore !== a.topStoryScore) return b.topStoryScore - a.topStoryScore;
      if (b.views !== a.views) return b.views - a.views;
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      return compareDateDesc(a, b);
    });
  }

  const total = sorted.length;
  const start = (page - 1) * limit;
  const paged = sorted.slice(start, start + limit);

  res.json({
    sort,
    articles: paged,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasMore: start + paged.length < total,
  });
}
