/**
 * K6: Public reading lists — users curate named lists of articles.
 * Lists are followable; the list owner can add/remove/reorder articles.
 */
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { param } from "../utils/params";
import { stripHtml } from "../utils/sanitize";
import { checkCuratorBadges } from "../services/badgeService";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueListSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let n = 1;
  while (true) {
    const exists = await prisma.readingList.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${slugify(base)}-${++n}`;
  }
}

/** GET /api/reading-lists — public lists (paginated). */
export async function listPublicReadingLists(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const currentUserId = req.user?.userId ?? null;

  const [lists, total] = await Promise.all([
    prisma.readingList.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { items: true, follows: true } },
      },
    }),
    prisma.readingList.count({ where: { isPublic: true } }),
  ]);

  let followedSet = new Set<string>();
  if (currentUserId && lists.length) {
    const followed = await prisma.readingListFollow.findMany({
      where: { userId: currentUserId, readingListId: { in: lists.map((l) => l.id) } },
      select: { readingListId: true },
    });
    followedSet = new Set(followed.map((f) => f.readingListId));
  }

  res.json({
    lists: lists.map((l) => ({
      id: l.id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      creator: l.user,
      itemCount: l._count.items,
      followCount: l._count.follows,
      isFollowing: followedSet.has(l.id),
      createdAt: l.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

/** GET /api/reading-lists/me — reading lists created by the current user. */
export async function getMyReadingLists(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const lists = await prisma.readingList.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true, follows: true } },
    },
  });

  res.json({
    lists: lists.map((l) => ({
      id: l.id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      isPublic: l.isPublic,
      itemCount: l._count.items,
      followCount: l._count.follows,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  });
}

/** GET /api/reading-lists/:slug — get public reading list detail with articles. */
export async function getReadingListBySlug(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const currentUserId = req.user?.userId ?? null;

  const list = await prisma.readingList.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { follows: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          article: {
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
              status: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });

  if (!list) {
    res.status(404).json({ error: "Reading list not found" });
    return;
  }
  // Private lists only visible to the owner.
  if (!list.isPublic && list.userId !== currentUserId) {
    res.status(403).json({ error: "This reading list is private" });
    return;
  }

  let isFollowing = false;
  if (currentUserId) {
    const follow = await prisma.readingListFollow.findUnique({
      where: { userId_readingListId: { userId: currentUserId, readingListId: list.id } },
    });
    isFollowing = !!follow;
  }

  res.json({
    list: {
      id: list.id,
      title: list.title,
      slug: list.slug,
      description: list.description,
      isPublic: list.isPublic,
      creator: list.user,
      followCount: list._count.follows,
      isFollowing,
      items: list.items
        .filter((item) => item.article.status === "PUBLISHED" || list.userId === currentUserId)
        .map((item) => ({
          id: item.id,
          position: item.position,
          addedAt: item.addedAt,
          article: item.article,
        })),
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    },
  });
}

/** POST /api/reading-lists — create a new reading list. */
export async function createReadingList(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const body = req.body as { title?: unknown; description?: unknown; isPublic?: unknown };

  const title = typeof body.title === "string" ? stripHtml(body.title).trim().slice(0, 120) : "";
  if (title.length < 2) {
    res.status(400).json({ error: "Title must be at least 2 characters" });
    return;
  }
  const description =
    typeof body.description === "string" ? stripHtml(body.description).trim().slice(0, 500) || null : null;
  const isPublic = body.isPublic !== false;

  const slug = await uniqueListSlug(title);

  const list = await prisma.readingList.create({
    data: { title, slug, description, isPublic, userId },
    include: { _count: { select: { items: true, follows: true } } },
  });

  res.status(201).json({
    list: {
      id: list.id,
      title: list.title,
      slug: list.slug,
      description: list.description,
      isPublic: list.isPublic,
      itemCount: list._count.items,
      followCount: list._count.follows,
      createdAt: list.createdAt,
    },
  });
}

/** PUT /api/reading-lists/:id — update metadata (owner only). */
export async function updateReadingList(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const listId = param(req.params.id);
  const body = req.body as { title?: unknown; description?: unknown; isPublic?: unknown };

  const list = await prisma.readingList.findUnique({ where: { id: listId } });
  if (!list) {
    res.status(404).json({ error: "Reading list not found" });
    return;
  }
  if (list.userId !== userId) {
    res.status(403).json({ error: "Not the list owner" });
    return;
  }

  const data: Prisma.ReadingListUpdateInput = {};
  if (typeof body.title === "string") {
    const title = stripHtml(body.title).trim().slice(0, 120);
    if (title.length >= 2) data.title = title;
  }
  if (typeof body.description === "string") {
    data.description = stripHtml(body.description).trim().slice(0, 500) || null;
  }
  if (typeof body.isPublic === "boolean") {
    data.isPublic = body.isPublic;
  }

  const updated = await prisma.readingList.update({ where: { id: listId }, data });
  res.json({ list: updated });
}

/** DELETE /api/reading-lists/:id — delete (owner only). */
export async function deleteReadingList(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const listId = param(req.params.id);

  const list = await prisma.readingList.findUnique({ where: { id: listId } });
  if (!list) {
    res.status(404).json({ error: "Reading list not found" });
    return;
  }
  if (list.userId !== userId) {
    res.status(403).json({ error: "Not the list owner" });
    return;
  }

  await prisma.readingList.delete({ where: { id: listId } });
  res.json({ ok: true });
}

/** POST /api/reading-lists/:id/items — add article to list. */
export async function addToReadingList(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const listId = param(req.params.id);
  const articleId = (req.body as any).articleId as string | undefined;

  const list = await prisma.readingList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== userId) {
    res.status(403).json({ error: "Not found or not the list owner" });
    return;
  }

  if (!articleId) {
    res.status(400).json({ error: "articleId required" });
    return;
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, status: true },
  });
  if (!article || article.status !== "PUBLISHED") {
    res.status(400).json({ error: "Article not found or not published" });
    return;
  }

  const maxPos = await prisma.readingListItem.aggregate({
    where: { readingListId: listId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  try {
    const item = await prisma.readingListItem.create({
      data: { readingListId: listId, articleId, position },
      include: {
        article: {
          select: {
            id: true, title: true, slug: true, excerpt: true, authorName: true, imageUrl: true, audioUrl: true, audioStatus: true, publishedAt: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
    });
    // K8: best-effort TOP_CURATOR badge (10+ items in any one list).
    const newBadges = await checkCuratorBadges(userId);
    res.status(201).json({ item, newBadges });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "Article already in this list" });
      return;
    }
    throw e;
  }
}

/** DELETE /api/reading-lists/:id/items/:articleId — remove article from list. */
export async function removeFromReadingList(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const listId = param(req.params.id);
  const articleId = param(req.params.articleId);

  const list = await prisma.readingList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== userId) {
    res.status(403).json({ error: "Not found or not the list owner" });
    return;
  }

  await prisma.readingListItem.deleteMany({
    where: { readingListId: listId, articleId },
  });
  res.json({ ok: true });
}

/** POST /api/reading-lists/:id/follow — toggle follow/unfollow. */
export async function toggleFollowReadingList(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const listId = param(req.params.id);

  const list = await prisma.readingList.findUnique({
    where: { id: listId },
    select: { id: true, isPublic: true },
  });
  if (!list || !list.isPublic) {
    res.status(404).json({ error: "Reading list not found" });
    return;
  }

  const existing = await prisma.readingListFollow.findUnique({
    where: { userId_readingListId: { userId, readingListId: listId } },
  });

  if (existing) {
    await prisma.readingListFollow.delete({ where: { id: existing.id } });
    const count = await prisma.readingListFollow.count({ where: { readingListId: listId } });
    res.json({ following: false, followCount: count });
  } else {
    await prisma.readingListFollow.create({ data: { userId, readingListId: listId } });
    const count = await prisma.readingListFollow.count({ where: { readingListId: listId } });
    res.json({ following: true, followCount: count });
  }
}
