import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { param } from "../utils/params";
import { hasUserBlockBetween } from "../utils/userBlocks";
import { checkSubscriptionBadges } from "../services/badgeService";

/**
 * Subscription system — users follow content creators (other users).
 *
 *  - Follow / Unfollow         (U1)
 *  - Mute / Unmute              (U8)  soft-hide without notifying creator
 *  - Block / Unblock            (5a)  creator removes a follower & prevents re-follow
 *  - Subscriber list (creator)  (C8)
 *  - Subscriptions list (user)  (U5)
 *  - Creator analytics          (C4)
 *
 * Verified-creator badge tiers (C5) are derived in queries — no DB column.
 * The thresholds are kept here so the frontend can share them.
 */
export const VERIFIED_THRESHOLDS = {
  verified: 10, // ✓ verified creator
  top: 100, //   ⭐ top creator
};

/** Compute a verified tier label from a follower count. */
export function verifiedTier(followers: number): "top" | "verified" | null {
  if (followers >= VERIFIED_THRESHOLDS.top) return "top";
  if (followers >= VERIFIED_THRESHOLDS.verified) return "verified";
  return null;
}

/** POST /api/users/:id/follow — current user starts following the target user. */
export async function followUser(req: Request, res: Response): Promise<void> {
  const subscriberId = req.user!.userId;
  const creatorId = param(req.params.id);

  if (creatorId === subscriberId) {
    res.status(400).json({ error: "You can't follow yourself" });
    return;
  }

  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { id: true, isActive: true },
  });
  if (!creator || !creator.isActive) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Block check: creator may have blocked the follower previously.
  const blocked = await prisma.creatorBlock.findUnique({
    where: { creatorId_blockedUserId: { creatorId, blockedUserId: subscriberId } },
  });
  if (blocked) {
    res.status(403).json({ error: "You can't follow this creator" });
    return;
  }

  const globallyBlocked = await hasUserBlockBetween(subscriberId, creatorId);
  if (globallyBlocked) {
    res.status(403).json({ error: "You cannot follow this user" });
    return;
  }

  try {
    const sub = await prisma.subscription.create({
      data: { subscriberId, creatorId },
    });
    // Fire a NEW_SUBSCRIBER notification for the creator (C3).
    await prisma.notification.create({
      data: {
        userId: creatorId,
        type: "NEW_SUBSCRIBER",
        payload: { subscriberId },
      },
    });
    // K8: best-effort SUPPORTER badge award.
    const newBadges = await checkSubscriptionBadges(subscriberId);
    res.status(201).json({ subscription: sub, newBadges });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "Already following" });
      return;
    }
    throw e;
  }
}

/** DELETE /api/users/:id/follow — current user unfollows the target. */
export async function unfollowUser(req: Request, res: Response): Promise<void> {
  const subscriberId = req.user!.userId;
  const creatorId = param(req.params.id);

  await prisma.subscription.deleteMany({
    where: { subscriberId, creatorId },
  });
  res.json({ ok: true });
}

/** POST /api/users/:id/mute — soft-mute a creator without unfollowing them. */
export async function muteCreator(req: Request, res: Response): Promise<void> {
  const subscriberId = req.user!.userId;
  const creatorId = param(req.params.id);
  const updated = await prisma.subscription.updateMany({
    where: { subscriberId, creatorId, mutedAt: null },
    data: { mutedAt: new Date() },
  });
  if (updated.count === 0) {
    res.status(404).json({ error: "Not following or already muted" });
    return;
  }
  res.json({ ok: true });
}

/** POST /api/users/:id/unmute — undo a mute. */
export async function unmuteCreator(req: Request, res: Response): Promise<void> {
  const subscriberId = req.user!.userId;
  const creatorId = param(req.params.id);
  await prisma.subscription.updateMany({
    where: { subscriberId, creatorId },
    data: { mutedAt: null },
  });
  res.json({ ok: true });
}

/** POST /api/me/blocks/:userId — current creator blocks a (would-be) follower
 *  and removes any existing subscription. */
export async function blockSubscriber(req: Request, res: Response): Promise<void> {
  const creatorId = req.user!.userId;
  const blockedUserId = param(req.params.userId);

  if (blockedUserId === creatorId) {
    res.status(400).json({ error: "You can't block yourself" });
    return;
  }

  await prisma.$transaction([
    prisma.subscription.deleteMany({
      where: { subscriberId: blockedUserId, creatorId },
    }),
    prisma.creatorBlock.upsert({
      where: { creatorId_blockedUserId: { creatorId, blockedUserId } },
      update: {},
      create: { creatorId, blockedUserId },
    }),
  ]);
  res.status(201).json({ ok: true });
}

/** DELETE /api/me/blocks/:userId — lift a previous block. */
export async function unblockSubscriber(req: Request, res: Response): Promise<void> {
  const creatorId = req.user!.userId;
  const blockedUserId = param(req.params.userId);
  await prisma.creatorBlock.deleteMany({
    where: { creatorId, blockedUserId },
  });
  res.json({ ok: true });
}

/** GET /api/me/subscriptions — list creators I follow + their latest article. */
export async function listMySubscriptions(req: Request, res: Response): Promise<void> {
  const subscriberId = req.user!.userId;
  const subs = await prisma.subscription.findMany({
    where: { subscriberId },
    orderBy: { createdAt: "desc" },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          bio: true,
          _count: { select: { subscriptionsReceived: true } },
          articles: {
            where: { status: "PUBLISHED" },
            orderBy: { publishedAt: "desc" },
            take: 1,
            select: {
              id: true,
              title: true,
              slug: true,
              publishedAt: true,
              imageUrl: true,
              audioUrl: true,
              audioStatus: true,
            },
          },
        },
      },
    },
  });

  res.json({
    subscriptions: subs.map((s) => ({
      creator: {
        id: s.creator.id,
        name: s.creator.name,
        avatarUrl: s.creator.avatarUrl,
        bio: s.creator.bio,
        subscriberCount: s.creator._count.subscriptionsReceived,
        verifiedTier: verifiedTier(s.creator._count.subscriptionsReceived),
      },
      mutedAt: s.mutedAt,
      since: s.createdAt,
      latestArticle: s.creator.articles[0] ?? null,
    })),
  });
}

/** GET /api/me/subscribers — list users following ME (creator side, C8). */
export async function listMySubscribers(req: Request, res: Response): Promise<void> {
  const creatorId = req.user!.userId;
  const subs = await prisma.subscription.findMany({
    where: { creatorId },
    orderBy: { createdAt: "desc" },
    include: {
      subscriber: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  // Also include any users I've blocked, so the creator sees the full picture
  // and can lift blocks if they choose to.
  const blocks = await prisma.creatorBlock.findMany({
    where: { creatorId },
    include: {
      blockedUser: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    subscribers: subs.map((s) => ({
      user: s.subscriber,
      since: s.createdAt,
    })),
    blocked: blocks.map((b) => ({ user: b.blockedUser, since: b.createdAt })),
  });
}

/**
 * GET /api/me/creator-stats — analytics for the current creator (C4).
 * Returns subscriber growth (last 30 days), total reads from subscribers vs
 * everyone else, and the creator's top 5 articles by views.
 */
export async function getCreatorStats(req: Request, res: Response): Promise<void> {
  const creatorId = req.user!.userId;
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Pull article ids belonging to this creator (only PUBLISHED count for stats).
  const myArticles = await prisma.article.findMany({
    where: { userId: creatorId, status: "PUBLISHED" },
    select: { id: true, title: true, slug: true, publishedAt: true },
  });
  const myArticleIds = myArticles.map((a) => a.id);

  // Count subscriber ids so we can join against ArticleView.userId.
  const myFollowers = await prisma.subscription.findMany({
    where: { creatorId },
    select: { subscriberId: true, createdAt: true },
  });
  const followerIds = myFollowers.map((s) => s.subscriberId);
  const totalFollowers = myFollowers.length;
  const followersLast30Days = myFollowers.filter(
    (s) => s.createdAt.getTime() >= thirtyDaysAgo.getTime()
  ).length;

  // Build a daily-growth series for the last 30 days. Simpler than groupBy on
  // date — we just bucket in JS.
  const growthByDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    growthByDay.set(key, 0);
  }
  for (const s of myFollowers) {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (growthByDay.has(key)) growthByDay.set(key, (growthByDay.get(key) ?? 0) + 1);
  }
  const dailyGrowth = Array.from(growthByDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Reads from followers vs. anyone else.
  const [readsFromFollowers, readsFromOthers, readsByArticle] =
    myArticleIds.length === 0
      ? [0, 0, [] as { articleId: string; _count: { _all: number } }[]]
      : await Promise.all([
          prisma.articleView.count({
            where: {
              articleId: { in: myArticleIds },
              userId: { in: followerIds },
            },
          }),
          prisma.articleView.count({
            where: {
              articleId: { in: myArticleIds },
              OR: [{ userId: null }, { userId: { notIn: followerIds } }],
            },
          }),
          prisma.articleView.groupBy({
            by: ["articleId"],
            where: { articleId: { in: myArticleIds } },
            _count: { _all: true },
          }),
        ]);

  const viewsByArticle = new Map(
    readsByArticle.map((r) => [r.articleId, r._count._all])
  );
  const topArticles = [...myArticles]
    .map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      publishedAt: a.publishedAt,
      views: viewsByArticle.get(a.id) ?? 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  res.json({
    totals: {
      followers: totalFollowers,
      followersLast30Days,
      verifiedTier: verifiedTier(totalFollowers),
      publishedArticles: myArticles.length,
      readsFromFollowers,
      readsFromOthers,
    },
    dailyGrowth,
    topArticles,
  });
}
