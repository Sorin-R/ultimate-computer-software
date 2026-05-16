import { Request, Response } from "express";
import prisma from "../config/db";
import { param } from "../utils/params";
import { verifiedTier } from "./subscriptionController";

/**
 * Public author profile endpoints (C2 + C9). Anyone can view, but the
 * "isFollowing" / "isMuted" / "iAmBlocked" flags require the optional auth
 * middleware so we know who the caller is.
 */

const ARTICLE_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  imageUrl: true,
  audioUrl: true,
  audioStatus: true,
  publishedAt: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
} as const;

/**
 * GET /api/authors/:id
 * Returns the author's public profile (bio, avatar, sub count, verified tier),
 * pinned article (if any), and a paginated list of their published articles.
 *
 *   ?page=1  ?limit=20
 */
export async function getAuthorProfile(req: Request, res: Response): Promise<void> {
  const idOrUsername = param(req.params.id);
  const callerId = req.user?.userId ?? null;

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));

  const userSelect = {
    id: true,
    name: true,
    username: true,
    bio: true,
    avatarUrl: true,
    isActive: true,
    createdAt: true,
    pinnedArticleId: true,
    _count: {
      select: {
        subscriptionsReceived: true,
        articles: { where: { status: "PUBLISHED" } },
      },
    },
  } as const;

  // Accept both CUID id and username slug for backward compatibility
  const author = await prisma.user.findFirst({
    where: {
      OR: [{ id: idOrUsername }, { username: idOrUsername }],
      isActive: true,
    },
    select: userSelect,
  });

  if (!author || !author.isActive) {
    res.status(404).json({ error: "Author not found" });
    return;
  }

  const authorId = author.id;

  const [pinned, articles, total] = await Promise.all([
    author.pinnedArticleId
      ? prisma.article.findUnique({
          where: { id: author.pinnedArticleId },
          select: ARTICLE_LIST_SELECT,
        })
      : Promise.resolve(null),
    prisma.article.findMany({
      where: { userId: authorId, status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: ARTICLE_LIST_SELECT,
    }),
    prisma.article.count({ where: { userId: authorId, status: "PUBLISHED" } }),
  ]);

  // Caller-relationship flags (only meaningful for logged-in callers).
  let isFollowing = false;
  let isMuted = false;
  let iAmBlocked = false;
  let isBlockedByMe = false;
  let hasBlockedMe = false;
  if (callerId && callerId !== authorId) {
    const [sub, creatorBlock, userBlocks] = await Promise.all([
      prisma.subscription.findUnique({
        where: { subscriberId_creatorId: { subscriberId: callerId, creatorId: authorId } },
      }),
      prisma.creatorBlock.findUnique({
        where: { creatorId_blockedUserId: { creatorId: authorId, blockedUserId: callerId } },
      }),
      prisma.userBlock.findMany({
        where: {
          OR: [
            { blockerUserId: callerId, blockedUserId: authorId },
            { blockerUserId: authorId, blockedUserId: callerId },
          ],
        },
        select: { blockerUserId: true, blockedUserId: true },
      }),
    ]);
    isFollowing = !!sub;
    isMuted = !!sub?.mutedAt;
    iAmBlocked = !!creatorBlock;
    isBlockedByMe = userBlocks.some(
      (block) => block.blockerUserId === callerId && block.blockedUserId === authorId
    );
    hasBlockedMe = userBlocks.some(
      (block) => block.blockerUserId === authorId && block.blockedUserId === callerId
    );
  }

  // Pinned shouldn't appear twice if it lands within the first page of
  // the regular list. We strip it from the list so the UI can render it
  // separately at the top.
  const articlesNoPinned = pinned
    ? articles.filter((a) => a.id !== pinned.id)
    : articles;

  res.json({
    author: {
      id: author.id,
      username: author.username,
      name: author.name,
      bio: author.bio,
      avatarUrl: author.avatarUrl,
      memberSince: author.createdAt,
      subscriberCount: author._count.subscriptionsReceived,
      articleCount: author._count.articles,
      verifiedTier: verifiedTier(author._count.subscriptionsReceived),
      isFollowing,
      isMuted,
      iAmBlocked,
      isBlockedByMe,
      hasBlockedMe,
      isSelf: callerId === authorId,
    },
    pinnedArticle: pinned,
    articles: articlesNoPinned,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}

/** PUT /api/me/profile — update bio + avatar URL. */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as { bio?: unknown; avatarUrl?: unknown };

  const bio =
    typeof body.bio === "string"
      ? body.bio.trim().slice(0, 2000)
      : body.bio === null
      ? null
      : undefined;
  const avatarUrl =
    typeof body.avatarUrl === "string"
      ? body.avatarUrl.trim().slice(0, 500) || null
      : body.avatarUrl === null
      ? null
      : undefined;

  // Build the update payload skipping unspecified fields so PUT is partial.
  const data: { bio?: string | null; avatarUrl?: string | null } = {};
  if (bio !== undefined) data.bio = bio === "" ? null : bio;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, bio: true, avatarUrl: true },
  });
  res.json({ user: updated });
}

/** PUT /api/me/pinned-article — set/clear the pinned article (C9). */
export async function setPinnedArticle(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as { articleId?: unknown };
  const articleId =
    typeof body.articleId === "string" && body.articleId.length > 0
      ? body.articleId
      : null;

  if (articleId) {
    // Must be one of MY published articles.
    const owned = await prisma.article.findUnique({
      where: { id: articleId },
      select: { userId: true, status: true },
    });
    if (!owned || owned.userId !== userId) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    if (owned.status !== "PUBLISHED") {
      res.status(400).json({ error: "Only published articles can be pinned" });
      return;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { pinnedArticleId: articleId },
  });
  res.json({ ok: true, pinnedArticleId: articleId });
}
