/**
 * K10: Polls — can be embedded in an article body or created as standalone
 * discussion posts (articleId = null, or linked to a DISCUSSION article).
 */
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { param } from "../utils/params";
import { stripHtml } from "../utils/sanitize";

const MAX_QUESTION = 300;
const MAX_OPTION = 120;
const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

/** POST /api/polls — create a poll. Optionally linked to an article. */
export async function createPoll(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const body = req.body as {
    question?: unknown;
    options?: unknown;
    articleId?: unknown;
    endsAt?: unknown;
  };

  const question = typeof body.question === "string"
    ? stripHtml(body.question).trim().slice(0, MAX_QUESTION)
    : "";
  if (question.length < 5) {
    res.status(400).json({ error: "Question must be at least 5 characters" });
    return;
  }

  if (!Array.isArray(body.options) || body.options.length < MIN_OPTIONS) {
    res.status(400).json({ error: `At least ${MIN_OPTIONS} options required` });
    return;
  }
  if (body.options.length > MAX_OPTIONS) {
    res.status(400).json({ error: `Maximum ${MAX_OPTIONS} options allowed` });
    return;
  }

  const options = (body.options as unknown[])
    .map((o, idx) => ({
      text: typeof o === "string" ? stripHtml(o).trim().slice(0, MAX_OPTION) : "",
      position: idx,
    }))
    .filter((o) => o.text.length >= 1);

  if (options.length < MIN_OPTIONS) {
    res.status(400).json({ error: "Not enough valid options" });
    return;
  }

  const articleId = typeof body.articleId === "string" ? body.articleId : null;
  if (articleId) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, userId: true },
    });
    if (!article || article.userId !== userId) {
      res.status(403).json({ error: "You do not own this article" });
      return;
    }
  }

  const endsAtRaw = typeof body.endsAt === "string" ? new Date(body.endsAt) : null;
  const endsAt = endsAtRaw && !isNaN(endsAtRaw.getTime()) ? endsAtRaw : null;

  const poll = await prisma.poll.create({
    data: {
      question,
      articleId,
      endsAt,
      options: {
        create: options.map((o) => ({ text: o.text, position: o.position })),
      },
    },
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { votes: true } },
    },
  });

  res.status(201).json({ poll: shapePoll(poll, null) });
}

/** GET /api/polls/:id — get poll with results. */
export async function getPoll(req: Request, res: Response): Promise<void> {
  const pollId = param(req.params.id);
  const currentUserId = req.user?.userId ?? null;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { votes: true } },
    },
  });

  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  let myVoteOptionId: string | null = null;
  if (currentUserId) {
    const myVote = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId: currentUserId } },
      select: { optionId: true },
    });
    myVoteOptionId = myVote?.optionId ?? null;
  }

  // Count votes per option.
  const voteCounts = await prisma.pollVote.groupBy({
    by: ["optionId"],
    where: { pollId },
    _count: { _all: true },
  });
  const voteMap: Record<string, number> = {};
  for (const v of voteCounts) voteMap[v.optionId] = v._count._all;

  res.json({ poll: shapePoll(poll, myVoteOptionId, voteMap) });
}

/** POST /api/polls/:id/vote — cast or change vote. */
export async function votePoll(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const pollId = param(req.params.id);
  const optionId = (req.body as any).optionId as string | undefined;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { id: true, endsAt: true },
  });
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  if (poll.endsAt && poll.endsAt < new Date()) {
    res.status(400).json({ error: "Poll has ended" });
    return;
  }

  if (!optionId) {
    res.status(400).json({ error: "optionId required" });
    return;
  }

  const option = await prisma.pollOption.findUnique({
    where: { id: optionId },
    select: { id: true, pollId: true },
  });
  if (!option || option.pollId !== pollId) {
    res.status(400).json({ error: "Invalid option" });
    return;
  }

  // Upsert: change vote if already voted, cast new if not.
  await prisma.$transaction(async (tx) => {
    await tx.pollVote.deleteMany({ where: { pollId, userId } });
    await tx.pollVote.create({ data: { pollId, optionId, userId } });
  });

  // Return updated results.
  const [pollFull, myVote, voteCounts] = await Promise.all([
    prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { orderBy: { position: "asc" } }, _count: { select: { votes: true } } },
    }),
    prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
      select: { optionId: true },
    }),
    prisma.pollVote.groupBy({
      by: ["optionId"],
      where: { pollId },
      _count: { _all: true },
    }),
  ]);

  const voteMap: Record<string, number> = {};
  for (const v of voteCounts) voteMap[v.optionId] = v._count._all;

  res.json({ poll: shapePoll(pollFull!, myVote?.optionId ?? null, voteMap) });
}

// ---------- helpers ----------

type RawPoll = Prisma.PollGetPayload<{
  include: {
    options: true;
    _count: { select: { votes: true } };
  };
}>;

function shapePoll(poll: RawPoll, myVoteOptionId: string | null, voteMap: Record<string, number> = {}) {
  const totalVotes = Object.values(voteMap).reduce((a, b) => a + b, 0);
  const isExpired = poll.endsAt ? poll.endsAt < new Date() : false;

  return {
    id: poll.id,
    question: poll.question,
    articleId: poll.articleId,
    endsAt: poll.endsAt,
    isExpired,
    totalVotes,
    myVoteOptionId,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      position: o.position,
      votes: voteMap[o.id] ?? 0,
      percentage: totalVotes > 0 ? Math.round(((voteMap[o.id] ?? 0) / totalVotes) * 100) : 0,
    })),
  };
}

/** GET /api/articles/:articleId/polls — polls embedded in a specific article. */
export async function getArticlePolls(req: Request, res: Response): Promise<void> {
  const articleId = param(req.params.articleId);
  const currentUserId = req.user?.userId ?? null;

  const polls = await prisma.poll.findMany({
    where: { articleId },
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { votes: true } },
    },
  });

  const results = await Promise.all(
    polls.map(async (poll) => {
      let myVoteOptionId: string | null = null;
      if (currentUserId) {
        const v = await prisma.pollVote.findUnique({
          where: { pollId_userId: { pollId: poll.id, userId: currentUserId } },
          select: { optionId: true },
        });
        myVoteOptionId = v?.optionId ?? null;
      }
      const voteCounts = await prisma.pollVote.groupBy({
        by: ["optionId"],
        where: { pollId: poll.id },
        _count: { _all: true },
      });
      const voteMap: Record<string, number> = {};
      for (const v of voteCounts) voteMap[v.optionId] = v._count._all;
      return shapePoll(poll, myVoteOptionId, voteMap);
    })
  );

  res.json({ polls: results });
}
