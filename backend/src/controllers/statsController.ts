import { Request, Response } from "express";
import prisma from "../config/db";

function startOfUtcWeek(date = new Date()): Date {
  const value = new Date(date);
  const day = value.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  value.setUTCDate(value.getUTCDate() - diff);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

export async function getPublicStats(req: Request, res: Response): Promise<void> {
  const weekStart = startOfUtcWeek();

  const [
    totalPublishedArticles,
    totalCreators,
    totalComments,
    readsThisWeek,
    topCategoriesRaw,
    newestCreators,
  ] = await Promise.all([
    prisma.article.count({ where: { status: "PUBLISHED" } }),
    prisma.user.count({
      where: {
        isActive: true,
        articles: { some: { status: "PUBLISHED" } },
      },
    }),
    prisma.comment.count({ where: { status: "VISIBLE", article: { status: "PUBLISHED" } } }),
    prisma.articleView.count({
      where: {
        createdAt: { gte: weekStart },
        article: { status: "PUBLISHED" },
      },
    }),
    prisma.article.groupBy({
      by: ["categoryId"],
      where: {
        status: "PUBLISHED",
        views: { some: { createdAt: { gte: weekStart } } },
      },
      _count: { _all: true },
      orderBy: { _count: { categoryId: "desc" } },
      take: 5,
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        articles: { some: { status: "PUBLISHED" } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        createdAt: true,
        avatarUrl: true,
        _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
      },
    }),
  ]);

  const categoryIds = topCategoriesRaw.map((entry) => entry.categoryId);
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  const topCategories = topCategoriesRaw
    .map((entry) => {
      const category = categoriesById.get(entry.categoryId);
      if (!category) return null;
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        articleCount: entry._count._all,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  res.json({
    totals: {
      publishedArticles: totalPublishedArticles,
      creators: totalCreators,
      readsThisWeek,
      comments: totalComments,
    },
    topCategories,
    newestCreators,
    generatedAt: new Date().toISOString(),
  });
}
