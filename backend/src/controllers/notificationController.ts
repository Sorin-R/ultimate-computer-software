import { Request, Response } from "express";
import prisma from "../config/db";
import { param } from "../utils/params";

/**
 * In-app notification system. Two notification types so far:
 *   - NEW_ARTICLE     — a creator I follow just published
 *   - NEW_SUBSCRIBER  — someone followed me
 *
 * The NEW_ARTICLE fan-out is triggered from the article-publish flow via
 * `notifySubscribersOfNewArticle()` below — exported so articleController can
 * call it without coupling.
 */

const MAX_LIST = 50;

/**
 * Hydrate notification rows with the data their UI needs (article title /
 * subscriber name) so the frontend can render in one shot. Returns rows in
 * the same order as the input.
 */
async function hydrate(
  rows: { id: string; type: string; payload: any; readAt: Date | null; createdAt: Date }[]
) {
  // Collect the ids we'll need to look up.
  const articleIds = new Set<string>();
  const userIds = new Set<string>();
  for (const r of rows) {
    if (r.type === "NEW_ARTICLE" && typeof r.payload?.articleId === "string") {
      articleIds.add(r.payload.articleId);
    } else if (r.type === "NEW_SUBSCRIBER" && typeof r.payload?.subscriberId === "string") {
      userIds.add(r.payload.subscriberId);
    }
  }

  const [articles, users] = await Promise.all([
    articleIds.size
      ? prisma.article.findMany({
          where: { id: { in: Array.from(articleIds) } },
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            authorName: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        })
      : Promise.resolve([]),
    userIds.size
      ? prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : Promise.resolve([]),
  ]);
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    let extra: Record<string, unknown> = {};
    if (r.type === "NEW_ARTICLE") {
      const a = articleById.get(r.payload?.articleId);
      if (a) extra.article = a;
    } else if (r.type === "NEW_SUBSCRIBER") {
      const u = userById.get(r.payload?.subscriberId);
      if (u) extra.subscriber = u;
    }
    return {
      id: r.id,
      type: r.type,
      readAt: r.readAt,
      createdAt: r.createdAt,
      ...extra,
    };
  });
}

/** GET /api/me/notifications */
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_LIST,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  const items = await hydrate(rows);
  res.json({ notifications: items, unreadCount });
}

/** GET /api/me/notifications/unread-count — lightweight bell-icon refresh. */
export async function unreadCount(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const count = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  res.json({ unreadCount: count });
}

/** POST /api/me/notifications/read — mark all as read (or a single id). */
export async function markRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const idRaw = (req.body as { id?: unknown })?.id;
  if (typeof idRaw === "string" && idRaw.length > 0) {
    await prisma.notification.updateMany({
      where: { id: idRaw, userId, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
  res.json({ ok: true });
}

/** DELETE /api/me/notifications/:id */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const id = param(req.params.id);
  await prisma.notification.deleteMany({ where: { id, userId } });
  res.json({ ok: true });
}

/**
 * Fan-out: when an article transitions to PUBLISHED, create a NEW_ARTICLE
 * notification for every active follower of the author who hasn't muted them.
 * Idempotent — if the same article was already announced (e.g. an article was
 * unpublished and re-published), we skip recipients who already have a row
 * for it.
 */
export async function notifySubscribersOfNewArticle(
  articleId: string,
  creatorId: string
): Promise<void> {
  const followers = await prisma.subscription.findMany({
    where: { creatorId, mutedAt: null },
    select: { subscriberId: true },
  });
  if (followers.length === 0) return;

  // Skip recipients who already have a notification for this exact article.
  const alreadyNotified = await prisma.notification.findMany({
    where: {
      type: "NEW_ARTICLE",
      userId: { in: followers.map((f) => f.subscriberId) },
      payload: { equals: { articleId } },
    },
    select: { userId: true },
  });
  const skip = new Set(alreadyNotified.map((n) => n.userId));

  const data = followers
    .filter((f) => !skip.has(f.subscriberId))
    .map((f) => ({
      userId: f.subscriberId,
      type: "NEW_ARTICLE" as const,
      payload: { articleId },
    }));
  if (data.length === 0) return;

  await prisma.notification.createMany({ data });
}
