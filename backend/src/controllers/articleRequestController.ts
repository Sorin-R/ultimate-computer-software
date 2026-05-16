/**
 * K4: Article requests / wishlist — readers post topics they want covered;
 * creators can claim and fulfill them.
 */
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { param } from "../utils/params";
import { stripHtml } from "../utils/sanitize";

const MAX_TITLE = 160;
const MAX_DESC = 2000;

function sanitize(raw: unknown, max: number): string {
  return typeof raw === "string" ? stripHtml(raw).trim().slice(0, max) : "";
}

const VALID_STATUSES = ["OPEN", "CLAIMED", "FULFILLED", "CLOSED"] as const;

/** GET /api/requests — paginated list (newest first; optional filter by status). */
export async function listArticleRequests(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const statusRaw = req.query.status as string;
  const status = VALID_STATUSES.includes(statusRaw as any)
    ? (statusRaw as typeof VALID_STATUSES[number])
    : "OPEN";

  const currentUserId = req.user?.userId ?? null;

  const where = { status };
  const [requests, total] = await Promise.all([
    prisma.articleRequest.findMany({
      where,
      orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        requester: { select: { id: true, name: true } },
        claimedBy: { select: { id: true, name: true } },
        fulfilledArticle: { select: { id: true, title: true, slug: true } },
        _count: { select: { votes: true } },
      },
    }),
    prisma.articleRequest.count({ where }),
  ]);

  let votedSet = new Set<string>();
  if (currentUserId && requests.length) {
    const ids = requests.map((r) => r.id);
    const voted = await prisma.articleRequestVote.findMany({
      where: { userId: currentUserId, requestId: { in: ids } },
      select: { requestId: true },
    });
    votedSet = new Set(voted.map((v) => v.requestId));
  }

  res.json({
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      voteCount: r._count.votes,
      hasVoted: votedSet.has(r.id),
      requester: r.requester,
      claimedBy: r.claimedBy,
      fulfilledArticle: r.fulfilledArticle,
      createdAt: r.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

/** POST /api/requests — create a new article request. */
export async function createArticleRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const title = sanitize((req.body as any).title, MAX_TITLE);
  const description = sanitize((req.body as any).description, MAX_DESC) || null;

  if (title.length < 5) {
    res.status(400).json({ error: "Title must be at least 5 characters" });
    return;
  }

  const request = await prisma.articleRequest.create({
    data: { title, description, requesterId: userId },
    include: {
      requester: { select: { id: true, name: true } },
      _count: { select: { votes: true } },
    },
  });

  res.status(201).json({
    request: {
      id: request.id,
      title: request.title,
      description: request.description,
      status: request.status,
      voteCount: request._count.votes,
      hasVoted: false,
      requester: request.requester,
      createdAt: request.createdAt,
    },
  });
}

/** POST /api/requests/:id/vote — toggle upvote on a request. */
export async function voteArticleRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const requestId = param(req.params.id);

  const arReq = await prisma.articleRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true },
  });
  if (!arReq) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (arReq.status === "CLOSED") {
    res.status(400).json({ error: "Cannot vote on a closed request" });
    return;
  }

  try {
    const existing = await prisma.articleRequestVote.findUnique({
      where: { userId_requestId: { userId, requestId } },
    });
    if (existing) {
      await prisma.articleRequestVote.delete({ where: { id: existing.id } });
      const count = await prisma.articleRequestVote.count({ where: { requestId } });
      res.json({ voted: false, voteCount: count });
    } else {
      await prisma.articleRequestVote.create({ data: { userId, requestId } });
      const count = await prisma.articleRequestVote.count({ where: { requestId } });
      res.json({ voted: true, voteCount: count });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "Already voted" });
      return;
    }
    throw e;
  }
}

/** POST /api/requests/:id/claim — creator claims they'll write on this topic. */
export async function claimArticleRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const requestId = param(req.params.id);

  const arReq = await prisma.articleRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, claimedById: true },
  });
  if (!arReq) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (arReq.status !== "OPEN") {
    res.status(400).json({ error: "Request is not open for claiming" });
    return;
  }

  const updated = await prisma.articleRequest.update({
    where: { id: requestId },
    data: { status: "CLAIMED", claimedById: userId },
    select: { id: true, status: true, claimedBy: { select: { id: true, name: true } } },
  });

  res.json({ request: updated });
}

/** POST /api/requests/:id/fulfill — creator marks this request as fulfilled with an article id. */
export async function fulfillArticleRequest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const requestId = param(req.params.id);
  const articleId = (req.body as any).articleId as string | undefined;

  const arReq = await prisma.articleRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, claimedById: true },
  });
  if (!arReq) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (arReq.claimedById !== userId) {
    res.status(403).json({ error: "Only the creator who claimed this request can fulfill it" });
    return;
  }

  if (articleId) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, userId: true },
    });
    if (!article || article.userId !== userId) {
      res.status(400).json({ error: "Invalid article id" });
      return;
    }
  }

  const updated = await prisma.articleRequest.update({
    where: { id: requestId },
    data: { status: "FULFILLED", fulfilledArticleId: articleId ?? null },
    select: { id: true, status: true, fulfilledArticle: { select: { id: true, title: true, slug: true } } },
  });

  res.json({ request: updated });
}

/** DELETE /api/requests/:id — requester or admin can close/delete. */
export async function deleteArticleRequest(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const requestId = param(req.params.id);

  const arReq = await prisma.articleRequest.findUnique({
    where: { id: requestId },
    select: { id: true, requesterId: true },
  });
  if (!arReq) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const isOwner = arReq.requesterId === user.userId;
  const isAdmin = user.role === "ADMIN" || user.role === "MODERATOR";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  // Soft-close rather than hard-delete so vote history is preserved.
  await prisma.articleRequest.update({
    where: { id: requestId },
    data: { status: "CLOSED" },
  });
  res.json({ ok: true });
}
