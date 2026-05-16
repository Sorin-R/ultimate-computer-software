import { Request, Response } from "express";
import { Prisma, ReportReason } from "@prisma/client";
import prisma from "../config/db";
import { stripHtml } from "../utils/sanitize";
import { param } from "../utils/params";
import { blockedByUserIds, hasUserBlockBetween } from "../utils/userBlocks";
import { checkCommentBadges } from "../services/badgeService";

const MAX_LENGTH = 2000;
const MIN_LENGTH = 2;
const POST_COOLDOWN_SECONDS = 15; // basic anti-spam
const VALID_SORTS = ["newest", "oldest", "top"] as const;
type Sort = (typeof VALID_SORTS)[number];

/**
 * Sanitize a user-supplied comment string. We strip ALL HTML (comments are
 * plain text) and collapse whitespace. URLs are left as-is — the frontend will
 * auto-link them with `rel="ugc nofollow noopener"` for SEO/safety.
 */
function sanitizeCommentText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = stripHtml(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, MAX_LENGTH);
}

/** Re-shape a Prisma comment row + likes/replies aggregates into the JSON
 *  payload the frontend consumes. Hides content of soft-deleted/hidden
 *  comments while preserving thread structure. */
type RawComment = Prisma.CommentGetPayload<{
  include: {
    user: { select: { id: true; name: true } };
    _count: { select: { likes: true; replies: true } };
  };
}> & {
  liked?: boolean;
  reportedByMe?: boolean;
  isSubscriberOfAuthor?: boolean;
};

function shapeComment(c: RawComment, currentUserId: string | null) {
  const isDeleted = c.status === "DELETED";
  const isHidden = c.status === "HIDDEN";
  return {
    id: c.id,
    parentId: c.parentId,
    content: isDeleted
      ? "[deleted]"
      : isHidden
      ? "[hidden by moderator]"
      : c.content,
    status: c.status,
    createdAt: c.createdAt,
    editedAt: c.editedAt,
    author: isDeleted
      ? { id: null, name: "[deleted]" }
      : { id: c.user.id, name: c.user.name },
    likeCount: c._count.likes,
    replyCount: c._count.replies,
    liked: c.liked ?? false,
    reportedByMe: c.reportedByMe ?? false,
    // U7: true when this comment's author is also a subscriber of the
    // article's author. Resolved server-side in listComments.
    isSubscriberOfAuthor: c.isSubscriberOfAuthor ?? false,
    canEdit: !!currentUserId && c.userId === currentUserId && !isDeleted && !isHidden,
    canDelete: !!currentUserId && c.userId === currentUserId && !isDeleted,
  };
}

/**
 * GET /api/articles/:slug/comments
 * Public. Returns top-level comments + their replies (one level), paginated.
 * Query: ?sort=newest|oldest|top&page=1&limit=20
 */
export async function listComments(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const sortRaw = (req.query.sort as string) || "newest";
  const sort: Sort = (VALID_SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as Sort)
    : "newest";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true, status: true, userId: true },
  });
  if (!article || article.status !== "PUBLISHED") {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const currentUserId = req.user?.userId ?? null;

  const orderBy: Prisma.CommentOrderByWithRelationInput[] =
    sort === "oldest"
      ? [{ createdAt: "asc" }]
      : sort === "top"
      ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];

  const includeBlock = {
    user: { select: { id: true, name: true } },
    _count: { select: { likes: true, replies: true } },
  } as const;

  const blockedIds = currentUserId ? await blockedByUserIds(currentUserId) : [];
  const blockedWhere =
    blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {};

  const [topLevel, totalTop] = await Promise.all([
    prisma.comment.findMany({
      where: { articleId: article.id, parentId: null, ...blockedWhere },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: includeBlock,
    }),
    prisma.comment.count({ where: { articleId: article.id, parentId: null, ...blockedWhere } }),
  ]);

  // Fetch replies for the visible top-level set in one query.
  const topIds = topLevel.map((c) => c.id);
  const replies = topIds.length
    ? await prisma.comment.findMany({
        where: { parentId: { in: topIds }, ...blockedWhere },
        orderBy: { createdAt: "asc" },
        include: includeBlock,
      })
    : [];

  // Liked / reported flags for the current user (one round-trip each).
  let likedSet = new Set<string>();
  let reportedSet = new Set<string>();
  if (currentUserId) {
    const allIds = [...topIds, ...replies.map((r) => r.id)];
    if (allIds.length) {
      const [likes, reports] = await Promise.all([
        prisma.commentLike.findMany({
          where: { userId: currentUserId, commentId: { in: allIds } },
          select: { commentId: true },
        }),
        prisma.commentReport.findMany({
          where: { reporterId: currentUserId, commentId: { in: allIds } },
          select: { commentId: true },
        }),
      ]);
      likedSet = new Set(likes.map((l) => l.commentId));
      reportedSet = new Set(reports.map((r) => r.commentId));
    }
  }

  const repliesByParent = new Map<string, typeof replies>();
  for (const r of replies) {
    if (!r.parentId) continue;
    const arr = repliesByParent.get(r.parentId) ?? [];
    arr.push(r);
    repliesByParent.set(r.parentId, arr);
  }

  // U7: figure out which commenters subscribe to the article's author so the
  // frontend can render a "Subscriber" badge on those comments. One DB query
  // covering the whole visible page.
  const commenterIds = Array.from(
    new Set([...topLevel, ...replies].map((c) => c.userId))
  ).filter((uid) => uid !== article.userId);
  const subscriberIds = new Set<string>();
  if (commenterIds.length) {
    const subs = await prisma.subscription.findMany({
      where: {
        creatorId: article.userId,
        subscriberId: { in: commenterIds },
      },
      select: { subscriberId: true },
    });
    for (const s of subs) subscriberIds.add(s.subscriberId);
  }

  const enriched = (c: RawComment): RawComment => ({
    ...c,
    liked: likedSet.has(c.id),
    reportedByMe: reportedSet.has(c.id),
    isSubscriberOfAuthor: subscriberIds.has(c.userId),
  });

  const totalAll = await prisma.comment.count({
    where: { articleId: article.id, status: "VISIBLE", ...blockedWhere },
  });

  res.json({
    comments: topLevel.map((c) => ({
      ...shapeComment(enriched(c), currentUserId),
      replies: (repliesByParent.get(c.id) ?? []).map((r) =>
        shapeComment(enriched(r), currentUserId)
      ),
    })),
    page,
    totalPages: Math.max(1, Math.ceil(totalTop / limit)),
    totalTopLevel: totalTop,
    totalVisible: totalAll,
    sort,
  });
}

/** POST /api/articles/:slug/comments — create a top-level OR reply comment. */
export async function createComment(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const slug = param(req.params.slug);
  const content = sanitizeCommentText((req.body as { content?: unknown }).content);
  const parentIdRaw = (req.body as { parentId?: unknown }).parentId;
  const parentId =
    typeof parentIdRaw === "string" && parentIdRaw.length > 0 ? parentIdRaw : null;

  if (content.length < MIN_LENGTH) {
    res.status(400).json({ error: `Comment must be at least ${MIN_LENGTH} characters` });
    return;
  }

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true, status: true, userId: true },
  });
  if (!article || article.status !== "PUBLISHED") {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (userId !== article.userId) {
    const blocked = await hasUserBlockBetween(userId, article.userId);
    if (blocked) {
      res.status(403).json({ error: "You cannot comment on this content" });
      return;
    }
  }

  // Anti-spam: enforce a short cooldown between posts from the same user.
  const since = new Date(Date.now() - POST_COOLDOWN_SECONDS * 1000);
  const recent = await prisma.comment.findFirst({
    where: { userId, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) {
    res
      .status(429)
      .json({ error: `Please wait ${POST_COOLDOWN_SECONDS}s between comments` });
    return;
  }

  // If replying, the parent must belong to the same article. We flatten any
  // deeper nesting (reply-to-reply) onto the same parent thread to keep the UI
  // sane and avoid arbitrarily deep trees.
  let resolvedParentId: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, articleId: true, status: true },
    });
    if (!parent || parent.articleId !== article.id) {
      res.status(400).json({ error: "Invalid parent comment" });
      return;
    }
    if (parent.status !== "VISIBLE") {
      res.status(400).json({ error: "Cannot reply to a removed comment" });
      return;
    }
    // Flatten: a reply to a reply attaches to the original top-level parent.
    resolvedParentId = parent.parentId ?? parent.id;
  }

  const created = await prisma.comment.create({
    data: { content, articleId: article.id, userId, parentId: resolvedParentId },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { likes: true, replies: true } },
    },
  });

  // K8: best-effort badge award; never fails the response.
  const newBadges = await checkCommentBadges(userId);

  res.status(201).json({ comment: shapeComment(created as RawComment, userId), newBadges });
}

/** PUT /api/comments/:id — author can edit own non-deleted/hidden comment. */
export async function updateComment(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = param(req.params.id);
  const content = sanitizeCommentText((req.body as { content?: unknown }).content);
  if (content.length < MIN_LENGTH) {
    res.status(400).json({ error: `Comment must be at least ${MIN_LENGTH} characters` });
    return;
  }

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: "Cannot edit another user's comment" });
    return;
  }
  if (existing.status !== "VISIBLE") {
    res.status(400).json({ error: "Cannot edit a removed comment" });
    return;
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { content, editedAt: new Date() },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { likes: true, replies: true } },
    },
  });
  res.json({ comment: shapeComment(updated as RawComment, userId) });
}

/** DELETE /api/comments/:id — soft delete by author OR hard delete by admin. */
export async function deleteComment(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = param(req.params.id);
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  const isOwner = comment.userId === user.userId;
  const isAdmin = user.role === "ADMIN" || user.role === "MODERATOR";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  // Soft-delete preserves replies. Content is replaced with a placeholder on
  // read (see shapeComment).
  await prisma.comment.update({
    where: { id },
    data: { status: "DELETED", content: "" },
  });
  res.json({ ok: true });
}

/** POST /api/comments/:id/like — toggle like for current user. */
export async function toggleLike(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const commentId = param(req.params.id);

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, status: true },
  });
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  if (comment.status !== "VISIBLE") {
    res.status(400).json({ error: "Cannot like a removed comment" });
    return;
  }

  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentLike.create({ data: { commentId, userId } });
  }

  const likeCount = await prisma.commentLike.count({ where: { commentId } });
  res.json({ liked: !existing, likeCount });
}

/** POST /api/comments/:id/report — file an abuse report. */
export async function reportComment(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const commentId = param(req.params.id);
  const reasonRaw = (req.body as { reason?: unknown }).reason;
  const detailsRaw = (req.body as { details?: unknown }).details;

  const validReasons: ReportReason[] = [
    "SPAM",
    "HARASSMENT",
    "HATE_SPEECH",
    "MISINFORMATION",
    "OFF_TOPIC",
    "OTHER",
  ];
  const reason = validReasons.includes(reasonRaw as ReportReason)
    ? (reasonRaw as ReportReason)
    : null;
  if (!reason) {
    res.status(400).json({ error: "Invalid report reason" });
    return;
  }

  const details =
    typeof detailsRaw === "string" && detailsRaw.trim().length
      ? detailsRaw.trim().slice(0, 1000)
      : null;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true },
  });
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  if (comment.userId === userId) {
    res.status(400).json({ error: "Cannot report your own comment" });
    return;
  }

  const blocked = await hasUserBlockBetween(userId, comment.userId);
  if (blocked) {
    res.status(403).json({ error: "You cannot report this user while blocked" });
    return;
  }

  try {
    await prisma.$transaction([
      prisma.commentReport.create({
        data: { commentId, reporterId: userId, reason, details },
      }),
      prisma.contentReport.create({
        data: {
          reporterId: userId,
          targetType: "COMMENT",
          targetId: commentId,
          targetUserId: comment.userId,
          reason,
          description: details,
          status: "UNDER_REVIEW",
          statusUpdatedAt: new Date(),
        },
      }),
    ]);
  } catch (e) {
    // Unique constraint: already reported by this user.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "You already reported this comment" });
      return;
    }
    throw e;
  }

  res.status(201).json({ ok: true });
}

// ---------- Admin moderation endpoints ----------

/** GET /api/admin/comments/reports — list reports (default: PENDING). */
export async function listReports(req: Request, res: Response): Promise<void> {
  const status = (req.query.status as string) || "PENDING";
  const validStatuses = ["PENDING", "REVIEWED", "DISMISSED"];
  const where = validStatuses.includes(status) ? { status: status as any } : {};

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const [reports, total] = await Promise.all([
    prisma.commentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
        comment: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            article: { select: { id: true, title: true, slug: true } },
            _count: { select: { reports: true, likes: true } },
          },
        },
      },
    }),
    prisma.commentReport.count({ where }),
  ]);

  res.json({
    reports,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

/** PUT /api/admin/comments/:id/hide — moderator action: hide comment + close all
 *  outstanding reports against it. */
export async function hideComment(req: Request, res: Response): Promise<void> {
  const reviewerId = req.user!.userId;
  const id = param(req.params.id);

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  await prisma.$transaction([
    prisma.comment.update({ where: { id }, data: { status: "HIDDEN" } }),
    prisma.commentReport.updateMany({
      where: { commentId: id, status: "PENDING" },
      data: { status: "REVIEWED", reviewerId, reviewedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
}

/** PUT /api/admin/comments/:id/restore — un-hide a previously hidden comment. */
export async function restoreComment(req: Request, res: Response): Promise<void> {
  const id = param(req.params.id);
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  if (comment.status === "DELETED") {
    res.status(400).json({ error: "Cannot restore an author-deleted comment" });
    return;
  }
  await prisma.comment.update({ where: { id }, data: { status: "VISIBLE" } });
  res.json({ ok: true });
}

/** PUT /api/admin/comments/reports/:id/dismiss — drop a report w/o action. */
export async function dismissReport(req: Request, res: Response): Promise<void> {
  const reviewerId = req.user!.userId;
  const id = param(req.params.id);
  const report = await prisma.commentReport.findUnique({ where: { id } });
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  await prisma.commentReport.update({
    where: { id },
    data: { status: "DISMISSED", reviewerId, reviewedAt: new Date() },
  });
  res.json({ ok: true });
}
