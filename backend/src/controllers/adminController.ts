import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../config/db";
import { ArticleAudioStatus, ArticleStatus, Prisma, Role } from "@prisma/client";
import { param } from "../utils/params";
import { createSlug } from "../utils/slug";
import { notifySubscribersOfNewArticle } from "./notificationController";
import { checkAuthorBadges, checkVerifiedBadge } from "../services/badgeService";
import { sendArticlePublishedEmail, sendArticleRejectedEmail } from "../utils/email";
import { queueArticleAudioGeneration } from "../services/articleAudioService";
import { env } from "../config/env";

async function ensureUniqueCategorySlug(
  name: string,
  excludeCategoryId?: string
): Promise<string> {
  const base = createSlug(name) || "category";
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || existing.id === excludeCategoryId) {
      return slug;
    }

    counter++;
    slug = `${base}-${counter}`;
  }
}

async function ensureUniqueCategoryName(baseName: string): Promise<string> {
  let name = baseName;
  let counter = 1;

  while (
    await prisma.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    })
  ) {
    counter++;
    name = `${baseName} ${counter}`;
  }

  return name;
}

async function ensureUniqueUsername(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "user";

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt}`;
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

function parseDateBoundary(value: unknown, boundary: "start" | "end"): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const raw = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`)
    : new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveAdminArticleOrder(sort: string | undefined): Prisma.ArticleOrderByWithRelationInput {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" };
    case "created_desc":
      return { createdAt: "desc" };
    case "updated_asc":
      return { updatedAt: "asc" };
    case "published_desc":
      return { publishedAt: { sort: "desc", nulls: "last" } };
    case "published_asc":
      return { publishedAt: { sort: "asc", nulls: "last" } };
    case "title_asc":
      return { title: "asc" };
    case "title_desc":
      return { title: "desc" };
    case "views_desc":
      return { views: { _count: "desc" } };
    case "views_asc":
      return { views: { _count: "asc" } };
    case "updated_desc":
    default:
      return { updatedAt: "desc" };
  }
}

function resolveAdminActivityOrder(
  sort: string | undefined
): Prisma.AdminActivityLogOrderByWithRelationInput[] {
  switch (sort) {
    case "created_asc":
      return [{ createdAt: "asc" }];
    case "action_asc":
      return [{ action: "asc" }, { createdAt: "desc" }];
    case "action_desc":
      return [{ action: "desc" }, { createdAt: "desc" }];
    case "target_asc":
      return [{ targetType: "asc" }, { createdAt: "desc" }];
    case "target_desc":
      return [{ targetType: "desc" }, { createdAt: "desc" }];
    case "actor_role_asc":
      return [{ actorRole: "asc" }, { createdAt: "desc" }];
    case "actor_role_desc":
      return [{ actorRole: "desc" }, { createdAt: "desc" }];
    case "actor_name_asc":
      return [{ actor: { name: "asc" } }, { createdAt: "desc" }];
    case "actor_name_desc":
      return [{ actor: { name: "desc" } }, { createdAt: "desc" }];
    case "created_desc":
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function getPendingArticles(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.article.count({ where: { status: "SUBMITTED" } }),
  ]);

  res.json({ articles, total, page, totalPages: Math.ceil(total / limit) });
}

export async function getAllArticlesAdmin(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const audioStatus = typeof req.query.audioStatus === "string" ? req.query.audioStatus.trim() : "";
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const dateFieldRaw = typeof req.query.dateField === "string" ? req.query.dateField : "createdAt";
  const dateField = (["createdAt", "updatedAt", "publishedAt"].includes(dateFieldRaw)
    ? dateFieldRaw
    : "createdAt") as "createdAt" | "updatedAt" | "publishedAt";
  const dateFrom = parseDateBoundary(req.query.dateFrom, "start");
  const dateTo = parseDateBoundary(req.query.dateTo, "end");

  const where: Prisma.ArticleWhereInput = {};
  if (Object.values(ArticleStatus).includes(status as ArticleStatus)) {
    where.status = status as ArticleStatus;
  }
  if (Object.values(ArticleAudioStatus).includes(audioStatus as ArticleAudioStatus)) {
    where.audioStatus = audioStatus as ArticleAudioStatus;
  }
  if (query) {
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { title: { contains: query, mode: "insensitive" } },
    ];
  }
  if (dateFrom || dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    if (dateField === "publishedAt") {
      where.publishedAt = dateFilter;
    } else if (dateField === "updatedAt") {
      where.updatedAt = dateFilter;
    } else {
      where.createdAt = dateFilter;
    }
  }
  const orderBy = resolveAdminArticleOrder(req.query.sort as string | undefined);

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
        _count: { select: { views: true } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  // Compute estimated reading time (200 wpm average) and strip HTML tags for word count
  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ");
  const articlesWithStats = articles.map((a) => {
    const words = stripHtml(a.body ?? "").trim().split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.round(words / 200));
    return {
      ...a,
      body: undefined,
      viewCount: a._count.views,
      readingMinutes,
    };
  });

  res.json({ articles: articlesWithStats, total, page, totalPages: Math.ceil(total / limit) });
}

export async function approveArticle(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: { select: { status: true, name: true } },
      user: { select: { email: true, name: true } },
    },
  });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (article.category.status !== "ACTIVE") {
    res.status(400).json({
      error: `Category "${article.category.name}" is pending. Approve or reject the category first.`,
    });
    return;
  }

  const wasAlreadyPublished = article.status === "PUBLISHED";
  const updated = await prisma.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  // Fan-out NEW_ARTICLE notifications to the author's followers (C7). Skipped
  // for re-approvals so we don't double-notify when an admin re-approves an
  // already-published article. notifySubscribersOfNewArticle is also
  // idempotent at the row level, so this is belt-and-braces.
  if (!wasAlreadyPublished) {
    queueArticleAudioGeneration(updated);

    try {
      await notifySubscribersOfNewArticle(updated.id, updated.userId);
    } catch (err) {
      // Don't fail the approval if notification fan-out fails; just log.
      console.error("notifySubscribersOfNewArticle failed", err);
    }
    await sendArticlePublishedEmail(
      article.user.email,
      article.user.name || "there",
      article.title,
      article.slug
    );
    // K8: best-effort author-milestone badges (FIRST_ARTICLE, PROLIFIC_WRITER, MASTER_AUTHOR).
    await checkAuthorBadges(updated.userId);
  }

  res.json({ article: updated });
}

export async function generateArticleAudioAdmin(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);

  if (!env.ARTICLE_AUDIO_ENABLED) {
    res.status(400).json({ error: "Article audio generation is disabled." });
    return;
  }

  if (!env.OPENROUTER_API_KEY) {
    res.status(400).json({ error: "OPENROUTER_API_KEY is not configured on the backend." });
    return;
  }

  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      audioStatus: true,
    },
  });

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (article.status !== "PUBLISHED") {
    res.status(400).json({ error: "Only published articles can have public audio generated." });
    return;
  }

  if (article.audioStatus === "PROCESSING") {
    res.json({ article });
    return;
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      audioUrl: null,
      audioStatus: "PROCESSING",
      audioGeneratedAt: null,
      audioError: null,
    },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      audioStatus: true,
      audioUrl: true,
    },
  });

  queueArticleAudioGeneration(updated);
  res.status(202).json({ article: updated });
}

export async function rejectArticle(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const instructionsRaw = typeof req.body?.instructions === "string" ? req.body.instructions : "";
  const instructions = instructionsRaw.trim();

  if (!instructions) {
    res.status(400).json({ error: "Rejection instructions are required." });
    return;
  }

  if (instructions.length > 3000) {
    res.status(400).json({ error: "Rejection instructions must be 3000 characters or fewer." });
    return;
  }

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true } },
    },
  });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (article.status !== "SUBMITTED") {
    res.status(400).json({ error: "Only submitted articles can be rejected." });
    return;
  }

  try {
    await sendArticleRejectedEmail(
      article.user.email,
      article.user.name || "there",
      article.title,
      instructions
    );
  } catch (error) {
    console.error("Failed to send rejection email", error);
    res.status(502).json({
      error:
        "Could not send rejection email. Please verify email configuration and try again.",
    });
    return;
  }

  const updated = await prisma.article.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  res.json({ article: updated, emailSent: true });
}

export async function hideArticleAdmin(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (article.status === "HIDDEN") {
    res.json({ article });
    return;
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      status: "HIDDEN",
      isPinnedToHome: false,
    },
  });

  res.json({ article: updated });
}

export async function unhideArticleAdmin(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (article.status !== "HIDDEN") {
    res.status(400).json({ error: "Only hidden articles can be restored" });
    return;
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      isPinnedToHome: false,
    },
  });

  res.json({ article: updated });
}

export async function deleteArticleAdmin(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  await prisma.article.delete({ where: { id } });
  res.json({ message: "Article deleted" });
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.user.count({ where: { role: "USER" } }),
  ]);

  res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
}

export async function getModeratorUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MODERATOR"] } },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.user.count({ where: { role: { in: ["ADMIN", "MODERATOR"] } } }),
  ]);

  res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
}

export async function getAdminActivityLogs(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const actorRole = (req.query.actorRole as string | undefined)?.toUpperCase();
  const action = (req.query.action as string | undefined)?.trim();
  const targetType = (req.query.targetType as string | undefined)?.toUpperCase();
  const actorId = (req.query.actorId as string | undefined)?.trim();
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const dateFrom = parseDateBoundary(req.query.dateFrom, "start");
  const dateTo = parseDateBoundary(req.query.dateTo, "end");
  const orderBy = resolveAdminActivityOrder(req.query.sort as string | undefined);

  const where: Prisma.AdminActivityLogWhereInput = {};
  if (Object.values(Role).includes(actorRole as Role)) where.actorRole = actorRole as Role;
  if (targetType) where.targetType = targetType;
  if (actorId) where.actorId = actorId;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (query) {
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { action: { contains: query, mode: "insensitive" } },
      { targetType: { contains: query, mode: "insensitive" } },
      { targetId: { contains: query, mode: "insensitive" } },
      { targetLabel: { contains: query, mode: "insensitive" } },
      { details: { contains: query, mode: "insensitive" } },
      { actor: { is: { name: { contains: query, mode: "insensitive" } } } },
      { actor: { is: { email: { contains: query, mode: "insensitive" } } } },
    ];
  }
  if (dateFrom || dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;
    where.createdAt = dateFilter;
  }

  const [logs, total] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    prisma.adminActivityLog.count({ where }),
  ]);

  res.json({
    logs,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function createModeratorUser(req: Request, res: Response): Promise<void> {
  const { name, email, password, role } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  const normalizedName = (name || "").trim();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const normalizedRole = (role || "").trim().toUpperCase();

  if (!normalizedName || normalizedName.length < 2) {
    res.status(400).json({ error: "Name must be at least 2 characters" });
    return;
  }

  if (!normalizedEmail) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  if (!["ADMIN", "MODERATOR"].includes(normalizedRole)) {
    res.status(400).json({ error: "Role must be ADMIN or MODERATOR" });
    return;
  }

  if (
    !password ||
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    res.status(400).json({
      error:
        "Password must be at least 8 characters and include uppercase, lowercase, and a number",
    });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const username = await ensureUniqueUsername(normalizedName);

  const user = await prisma.user.create({
    data: {
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      role: normalizedRole as Role,
      username,
      emailVerified: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.status(201).json({ user });
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const { role } = req.body;
  if (!["USER", "MODERATOR", "ADMIN"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as Role },
    select: { id: true, name: true, email: true, role: true },
  });

  res.json({ user: updated });
}

export async function banUser(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const actorRole = req.user?.role;

  if (req.user?.userId === id) {
    res.status(400).json({ error: "You cannot ban your own account" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "ADMIN") {
    res.status(400).json({ error: "Cannot ban an admin user" });
    return;
  }

  if (actorRole === "MODERATOR" && user.role !== "USER") {
    res.status(403).json({ error: "Moderators can only ban regular users" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  res.json({ user: updated });
}

export async function reactivateUser(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const actorRole = req.user?.role;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (actorRole === "MODERATOR" && user.role !== "USER") {
    res.status(403).json({ error: "Moderators can only reactivate regular users" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  res.json({ user: updated });
}

export async function deleteUserPermanently(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);

  if (req.user?.userId === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, _count: { select: { articles: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "ADMIN") {
    res.status(400).json({ error: "Cannot permanently delete an admin user" });
    return;
  }

  await prisma.$transaction([
    prisma.article.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  res.json({ message: "User permanently deleted", deletedArticles: user._count.articles });
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  const [totalArticles, pendingArticles, publishedArticles, totalUsers, totalCategories, viewStats] =
    await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: "SUBMITTED" } }),
      prisma.article.count({ where: { status: "PUBLISHED" } }),
      prisma.user.count(),
      prisma.category.count({ where: { status: "ACTIVE" } }),
      prisma.articleView.aggregate({
        _count: { _all: true },
        _avg: { timeSpentSeconds: true },
      }),
    ]);

  const totalViews = viewStats._count._all;
  const averageTimeSeconds = viewStats._avg.timeSpentSeconds || 0;
  const averageTimeMinutes = Math.round(averageTimeSeconds / 60 * 10) / 10; // Round to 1 decimal place

  res.json({
    totalArticles,
    pendingArticles,
    publishedArticles,
    totalUsers,
    totalCategories,
    totalViews,
    averageTimeSeconds: Math.round(averageTimeSeconds),
    averageTimeMinutes,
  });
}

export async function getArticlePopularity(_req: Request, res: Response): Promise<void> {
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
      _count: { select: { views: true } },
    },
    orderBy: { views: { _count: "desc" } },
    take: 10,
  });

  res.json({ articles });
}

export async function getAllCategoriesAdmin(_req: Request, res: Response): Promise<void> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { articles: true } },
    },
  });

  res.json({ categories });
}

export async function updateCategoryAdmin(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const { name, description, status } = req.body;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const data: Record<string, unknown> = {};
  if (typeof name === "string") {
    const trimmedName = name.trim();
    if (!trimmedName) {
      res.status(400).json({ error: "Category name is required" });
      return;
    }

    const existingByName = await prisma.category.findFirst({
      where: {
        id: { not: id },
        name: { equals: trimmedName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existingByName) {
      res.status(409).json({ error: "Category name already exists" });
      return;
    }

    data.name = trimmedName;
    data.slug = await ensureUniqueCategorySlug(trimmedName, id);
  }
  if (description !== undefined) data.description = description;
  if (status && ["ACTIVE", "PENDING"].includes(status)) data.status = status;

  const updated = await prisma.category.update({ where: { id }, data });
  res.json({ category: updated });
}

export async function deleteCategoryAdmin(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const articleCount = await prisma.article.count({ where: { categoryId: id } });
  let reassignedTo: { id: string; name: string } | null = null;

  if (articleCount > 0) {
    let fallbackCategory = await prisma.category.findFirst({
      where: {
        id: { not: id },
        status: "ACTIVE",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });

    if (!fallbackCategory) {
      const fallbackName = await ensureUniqueCategoryName("Uncategorized");
      const fallbackSlug = await ensureUniqueCategorySlug(fallbackName);
      fallbackCategory = await prisma.category.create({
        data: {
          name: fallbackName,
          slug: fallbackSlug,
          status: "ACTIVE",
        },
        select: { id: true, name: true },
      });
    }

    await prisma.article.updateMany({
      where: { categoryId: id },
      data: { categoryId: fallbackCategory.id },
    });

    reassignedTo = fallbackCategory;
  }

  await prisma.category.delete({ where: { id } });
  res.json({
    message: "Category deleted",
    reassignedArticles: articleCount,
    reassignedTo: reassignedTo?.name ?? null,
  });
}

// AdSense Configuration Management

export async function getAdSenseConfigs(_req: Request, res: Response): Promise<void> {
  const configs = await prisma.adSenseConfig.findMany({
    orderBy: { placement: "asc" },
  });
  res.json({ configs });
}

export async function createAdSenseConfig(req: Request, res: Response): Promise<void> {
  const { displayName, code, placement, adType, width, height } = req.body;
  const validPlacements = [
    "home-top",
    "homepage",
    "article",
    "category",
    "dashboard",
    "dashboard_sidebar",
    "sidebar",
    "related_articles_1",
    "related_articles_2",
    "related_articles_3",
  ];

  if (!displayName || !displayName.trim()) {
    res.status(400).json({ error: "Display name is required" });
    return;
  }

  if (!code || !code.trim()) {
    res.status(400).json({ error: "AdSense code is required" });
    return;
  }

  if (!placement || !validPlacements.includes(placement)) {
    res.status(400).json({ error: "Valid placement is required" });
    return;
  }

  // Check if displayName already exists
  const existing = await prisma.adSenseConfig.findUnique({
    where: { displayName: displayName.trim() },
  });

  if (existing) {
    res.status(409).json({ error: "Display name already exists" });
    return;
  }

  const config = await prisma.adSenseConfig.create({
    data: {
      displayName: displayName.trim(),
      code: code.trim(),
      placement,
      adType: adType || "display",
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
    },
  });

  res.json({ config });
}

export async function updateAdSenseConfig(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const { displayName, code, placement, adType, width, height, isActive } = req.body;
  const validPlacements = [
    "home-top",
    "homepage",
    "article",
    "category",
    "dashboard",
    "dashboard_sidebar",
    "sidebar",
    "related_articles_1",
    "related_articles_2",
    "related_articles_3",
  ];

  const existing = await prisma.adSenseConfig.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "AdSense config not found" });
    return;
  }

  const data: Record<string, unknown> = {};

  if (displayName !== undefined) {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      res.status(400).json({ error: "Display name is required" });
      return;
    }

    const duplicate = await prisma.adSenseConfig.findFirst({
      where: {
        id: { not: id },
        displayName: trimmedName,
      },
    });

    if (duplicate) {
      res.status(409).json({ error: "Display name already exists" });
      return;
    }

    data.displayName = trimmedName;
  }

  if (code !== undefined) {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      res.status(400).json({ error: "AdSense code is required" });
      return;
    }
    data.code = trimmedCode;
  }

  if (placement !== undefined) {
    if (!validPlacements.includes(placement)) {
      res.status(400).json({ error: "Invalid placement" });
      return;
    }
    data.placement = placement;
  }

  if (adType !== undefined) data.adType = adType;
  if (width !== undefined) data.width = width ? parseInt(width) : null;
  if (height !== undefined) data.height = height ? parseInt(height) : null;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.adSenseConfig.update({
    where: { id },
    data,
  });

  res.json({ config: updated });
}

export async function deleteAdSenseConfig(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);

  const config = await prisma.adSenseConfig.findUnique({ where: { id } });
  if (!config) {
    res.status(404).json({ error: "AdSense config not found" });
    return;
  }

  await prisma.adSenseConfig.delete({ where: { id } });
  res.json({ message: "AdSense config deleted" });
}

export async function toggleVerifyUser(req: import("express").Request, res: import("express").Response): Promise<void> {
  const id = param(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isVerified: true } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const updated = await prisma.user.update({
    where: { id },
    data: { isVerified: !user.isVerified },
    select: { id: true, name: true, email: true, role: true, isVerified: true },
  });
  // K8: award VERIFIED_AUTHOR badge when toggling on. Stays awarded if later
  // toggled off — historical badges aren't revoked.
  if (updated.isVerified) {
    await checkVerifiedBadge(updated.id);
  }
  res.json({ user: updated });
}
