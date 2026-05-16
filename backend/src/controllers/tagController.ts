/**
 * K9: Per-tag follows — users can subscribe to individual tags and get a
 * personalised feed filtered by their followed tags.
 */
import { Request, Response } from "express";
import prisma from "../config/db";
import { param } from "../utils/params";

/** GET /api/tags/:slug — get a single tag with its article list. */
export async function getTag(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const currentUserId = req.user?.userId ?? null;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 18));

  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      // M1: Include description for SEO meta and tag archive page display
      description: true,
      category: { select: { name: true, slug: true } },
      _count: { select: { follows: true, articles: true } },
    },
  });

  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }

  let isFollowing = false;
  if (currentUserId) {
    const follow = await prisma.tagFollow.findUnique({
      where: { userId_tagId: { userId: currentUserId, tagId: tag.id } },
    });
    isFollowing = !!follow;
  }

  const where = { status: "PUBLISHED" as const, tags: { some: { tagId: tag.id } } };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  res.json({
    tag: {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      category: tag.category,
      followCount: tag._count.follows,
      articleCount: tag._count.articles,
      isFollowing,
    },
    articles,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

/** GET /api/tags — list all tags (with follow count and optional "am I following?" flag). */
export async function listTags(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user?.userId ?? null;
  const categorySlug = req.query.category as string | undefined;

  const where = categorySlug
    ? { category: { slug: categorySlug } }
    : undefined;

  const tags = await prisma.tag.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      category: { select: { name: true, slug: true } },
      _count: { select: { follows: true, articles: true } },
    },
    orderBy: { name: "asc" },
  });

  let followedSet = new Set<string>();
  if (currentUserId) {
    const followed = await prisma.tagFollow.findMany({
      where: { userId: currentUserId },
      select: { tagId: true },
    });
    followedSet = new Set(followed.map((f) => f.tagId));
  }

  res.json({
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      category: t.category,
      followCount: t._count.follows,
      articleCount: t._count.articles,
      isFollowing: followedSet.has(t.id),
    })),
  });
}

/** GET /api/tags/me — tags the current user follows. */
export async function getMyFollowedTags(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const follows = await prisma.tagFollow.findMany({
    where: { userId },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: { select: { name: true, slug: true } },
          _count: { select: { follows: true, articles: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    tags: follows.map((f) => ({
      id: f.tag.id,
      name: f.tag.name,
      slug: f.tag.slug,
      category: f.tag.category,
      followCount: f.tag._count.follows,
      articleCount: f.tag._count.articles,
      isFollowing: true,
    })),
  });
}

/** POST /api/tags/:slug/follow — toggle follow/unfollow a tag. */
export async function toggleTagFollow(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const slug = param(req.params.slug);

  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }

  const existing = await prisma.tagFollow.findUnique({
    where: { userId_tagId: { userId, tagId: tag.id } },
  });

  if (existing) {
    await prisma.tagFollow.delete({ where: { id: existing.id } });
    res.json({ following: false, tag });
  } else {
    await prisma.tagFollow.create({ data: { userId, tagId: tag.id } });
    res.json({ following: true, tag });
  }
}

/**
 * GET /api/tags/feed — articles filtered by the current user's followed tags.
 * Falls back to regular feed if the user doesn't follow any tags.
 */
export async function getTagFeed(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));

  const follows = await prisma.tagFollow.findMany({
    where: { userId },
    select: { tagId: true },
  });

  if (follows.length === 0) {
    res.json({ articles: [], total: 0, page, totalPages: 0, message: "Follow tags to see a personalised feed" });
    return;
  }

  const tagIds = follows.map((f) => f.tagId);

  const where = {
    status: "PUBLISHED" as const,
    tags: { some: { tagId: { in: tagIds } } },
  };

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
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  res.json({
    articles: articlesBase,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
