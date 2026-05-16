import { Request, Response } from "express";
import prisma from "../config/db";
import { param } from "../utils/params";
import { checkBookmarkBadges } from "../services/badgeService";

const ARTICLE_SELECT = {
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
} as const;

/** GET /api/bookmarks — list the current user's bookmarks (newest first). */
export async function listBookmarks(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));

  const [rows, total] = await Promise.all([
    prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { article: { select: ARTICLE_SELECT } },
    }),
    prisma.bookmark.count({ where: { userId } }),
  ]);

  res.json({
    bookmarks: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** POST /api/bookmarks — toggle: add if missing, remove if present. */
export async function toggleBookmark(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { articleId } = req.body;

  if (!articleId || typeof articleId !== "string") {
    res.status(400).json({ error: "articleId is required" });
    return;
  }

  // Verify article exists and is published.
  const article = await prisma.article.findFirst({
    where: { id: articleId, status: { in: ["PUBLISHED", "APPROVED"] } },
    select: { id: true },
  });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const existing = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId, articleId } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    res.json({ bookmarked: false });
  } else {
    await prisma.bookmark.create({ data: { userId, articleId } });
    // K8: best-effort badge award.
    const newBadges = await checkBookmarkBadges(userId);
    res.json({ bookmarked: true, newBadges });
  }
}

/** GET /api/bookmarks/check/:articleId — is this article bookmarked by me? */
export async function checkBookmark(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const articleId = param(req.params.articleId);

  const row = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId, articleId } },
  });
  res.json({ bookmarked: !!row });
}
