import { Request, Response } from "express";
import prisma from "../config/db";
import { uniqueCategorySlug, uniqueTagSlug } from "../utils/slug";
import { param } from "../utils/params";

export async function getCategories(_req: Request, res: Response): Promise<void> {
  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
    },
  });

  // Compute the average reader-time per category: average of timeSpentSeconds
  // across every ArticleView whose article belongs to the category. Used to
  // rank categories by reader engagement (the "most read" categories surface
  // at the top of the homepage).
  const aggregates = await prisma.$queryRaw<
    Array<{ categoryId: string; avgSeconds: number | null; viewCount: bigint }>
  >`
    SELECT a."categoryId",
           AVG(av."timeSpentSeconds")::float AS "avgSeconds",
           COUNT(*)::bigint AS "viewCount"
    FROM "article_views" av
    JOIN "articles" a ON a."id" = av."articleId"
    WHERE a."status" = 'PUBLISHED'
    GROUP BY a."categoryId"
  `;

  const statsByCategory = new Map<
    string,
    { avgSeconds: number; viewCount: number }
  >();
  for (const row of aggregates) {
    statsByCategory.set(row.categoryId, {
      avgSeconds: row.avgSeconds ?? 0,
      viewCount: Number(row.viewCount),
    });
  }

  // Categories with zero views fall back to a 0 average and sort to the
  // bottom; ties (e.g. all 0s) keep alphabetical order.
  const enriched = categories
    .map((c) => {
      const s = statsByCategory.get(c.id) ?? { avgSeconds: 0, viewCount: 0 };
      return {
        ...c,
        avgReadTimeSeconds: Math.round(s.avgSeconds),
        totalViews: s.viewCount,
      };
    })
    .sort((a, b) => {
      if (b.avgReadTimeSeconds !== a.avgReadTimeSeconds) {
        return b.avgReadTimeSeconds - a.avgReadTimeSeconds;
      }
      // Tie-breaker: more views, then alphabetical.
      if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews;
      return a.name.localeCompare(b.name);
    });

  res.json({ categories: enriched });
}

export async function getCategoriesForUser(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const categories = await prisma.category.findMany({
    where: {
      OR: [{ status: "ACTIVE" }, { createdByUserId: userId }],
    },
    orderBy: [{ status: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      description: true,
      _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
    },
  });

  res.json({ categories });
}

export async function getCategoryBySlug(req: Request, res: Response): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { slug: param(req.params.slug), status: "ACTIVE" },
  });

  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 12;

  const [articlesBase, total] = await Promise.all([
    prisma.article.findMany({
      where: { categoryId: category.id, status: "PUBLISHED" },
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
      },
    }),
    prisma.article.count({
      where: { categoryId: category.id, status: "PUBLISHED" },
    }),
  ]);

  // Fetch rating and views for each article
  const articles = await Promise.all(
    articlesBase.map(async (article) => {
      const [rating, views] = await Promise.all([
        prisma.review.aggregate({
          where: { articleId: article.id },
          _avg: { rating: true },
          _count: { _all: true },
        }),
        prisma.articleView.aggregate({
          where: { articleId: article.id },
          _count: { _all: true },
        }),
      ]);

      return {
        ...article,
        rating: {
          average: rating._avg.rating ?? 0,
          count: rating._count._all,
        },
        views: {
          totalViews: views._count._all,
        },
      };
    })
  );

  res.json({ category, articles, total, page, totalPages: Math.ceil(total / limit) });
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const { name, description } = req.body;

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) {
    res.status(409).json({ error: "Category already exists" });
    return;
  }

  const slug = await uniqueCategorySlug(name);
  const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "MODERATOR";
  const userId = req.user!.userId;

  const category = await prisma.category.create({
    data: {
      name,
      slug,
      description: description || null,
      status: isAdmin ? "ACTIVE" : "PENDING",
      createdByUserId: userId,
    },
  });

  res.status(201).json({ category });
}

export async function getTags(req: Request, res: Response): Promise<void> {
  // Optional `categoryId` (or `categorySlug`) query param scopes the result to
  // tags belonging to that category. With no filter, all tags are returned.
  const rawCategoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const rawCategorySlug = typeof req.query.categorySlug === "string" ? req.query.categorySlug : undefined;

  let resolvedCategoryId: string | undefined = rawCategoryId;
  if (!resolvedCategoryId && rawCategorySlug) {
    const cat = await prisma.category.findUnique({
      where: { slug: rawCategorySlug },
      select: { id: true },
    });
    resolvedCategoryId = cat?.id;
  }

  const tags = await prisma.tag.findMany({
    where: resolvedCategoryId ? { categoryId: resolvedCategoryId } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, categoryId: true },
  });

  res.json({ tags });
}

export async function createTag(req: Request, res: Response): Promise<void> {
  const { name, categoryId } = req.body as { name: string; categoryId?: string };
  const normalizedName = name.trim();

  const existing = await prisma.tag.findFirst({
    where: { name: { equals: normalizedName, mode: "insensitive" } },
    select: { id: true, name: true, slug: true, categoryId: true },
  });

  if (existing) {
    res.status(409).json({ error: "Tag already exists", tag: existing });
    return;
  }

  // If the client specifies a category, validate it exists. Otherwise leave
  // the new tag uncategorised (a moderator can curate it later).
  let resolvedCategoryId: string | null = null;
  if (categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (cat) resolvedCategoryId = cat.id;
  }

  const slug = await uniqueTagSlug(normalizedName);
  const tag = await prisma.tag.create({
    data: {
      name: normalizedName,
      slug,
      categoryId: resolvedCategoryId,
    },
    select: { id: true, name: true, slug: true, categoryId: true },
  });

  res.status(201).json({ tag });
}
