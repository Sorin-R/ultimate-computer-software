import { Request, Response } from "express";
import { hasUserBlockBetween } from "../utils/userBlocks";
import prisma from "../config/db";

/**
 * GET /api/articles/:slug/reviews
 * Public endpoint. Returns the list of reviews + aggregate stats
 * (count, average) for an article.
 */
export async function listReviews(req: Request, res: Response): Promise<void> {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });

  if (!article || article.status !== "PUBLISHED") {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const [reviews, agg] = await Promise.all([
    prisma.review.findMany({
      where: { articleId: article.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.review.aggregate({
      where: { articleId: article.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  res.json({
    reviews,
    stats: {
      count: agg._count._all,
      average: agg._avg.rating ?? 0,
    },
  });
}

/**
 * POST /api/articles/:slug/reviews
 * Authenticated. Creates or updates the calling user's review for the article.
 * Body: { rating: 1..5, comment?: string }
 */
export async function upsertReview(
  req: Request & { user?: { userId: string } },
  res: Response
): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const ratingRaw = (req.body as { rating?: unknown }).rating;
  const commentRaw = (req.body as { comment?: unknown }).comment;

  const rating = Number(ratingRaw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    return;
  }

  const comment =
    typeof commentRaw === "string" && commentRaw.trim().length > 0
      ? commentRaw.trim().slice(0, 2000)
      : null;

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true, status: true, userId: true },
  });

  if (!article || article.status !== "PUBLISHED") {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  // Authors can't rate their own article.
  if (article.userId === userId) {
    res.status(403).json({ error: "Authors cannot review their own article" });
    return;
  }

  const blocked = await hasUserBlockBetween(userId, article.userId);
  if (blocked) {
    res.status(403).json({ error: "You cannot review this article" });
    return;
  }

  const review = await prisma.review.upsert({
    where: { articleId_userId: { articleId: article.id, userId } },
    update: { rating, comment },
    create: { rating, comment, articleId: article.id, userId },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  const agg = await prisma.review.aggregate({
    where: { articleId: article.id },
    _avg: { rating: true },
    _count: { _all: true },
  });

  res.status(201).json({
    review,
    stats: {
      count: agg._count._all,
      average: agg._avg.rating ?? 0,
    },
  });
}
