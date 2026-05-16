import { Request, Response } from "express";
import prisma from "../config/db";
import { ReactionEmoji } from "@prisma/client";
import { param } from "../utils/params";
import { hasUserBlockBetween } from "../utils/userBlocks";

const VALID_EMOJIS: ReactionEmoji[] = ["LIKE", "LOVE", "WOW", "THINK", "HUNDRED", "QUESTION"];

/** GET /api/articles/:slug/reactions — aggregate counts + caller's reaction. */
export async function getReactions(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const userId = req.user?.userId ?? null;

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const [counts, mine] = await Promise.all([
    prisma.articleReaction.groupBy({
      by: ["emoji"],
      where: { articleId: article.id },
      _count: { id: true },
    }),
    userId
      ? prisma.articleReaction.findUnique({
          where: { userId_articleId: { userId, articleId: article.id } },
          select: { emoji: true },
        })
      : null,
  ]);

  // Build a complete map (0 for emojis with no reactions).
  const totals: Record<ReactionEmoji, number> = {
    LIKE: 0, LOVE: 0, WOW: 0, THINK: 0, HUNDRED: 0, QUESTION: 0,
  };
  for (const row of counts) {
    totals[row.emoji] = row._count.id;
  }

  res.json({ totals, myReaction: mine?.emoji ?? null });
}

/** POST /api/articles/:slug/reactions — upsert or remove reaction.
 *  Body: { emoji: "LIKE"|"LOVE"|"WOW"|"THINK" | null }
 *  Sending null (or omitting) removes the current reaction.
 */
export async function upsertReaction(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);
  const userId = req.user!.userId;
  const { emoji } = req.body as { emoji: ReactionEmoji | null };

  // null/undefined means "remove reaction"
  if (emoji !== null && emoji !== undefined && !VALID_EMOJIS.includes(emoji)) {
    res.status(400).json({ error: "Invalid emoji. Must be LIKE, LOVE, WOW, or THINK" });
    return;
  }

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true, userId: true },
  });
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const blocked = await hasUserBlockBetween(userId, article.userId);
  if (blocked) {
    res.status(403).json({ error: "You cannot react to this article" });
    return;
  }

  const articleId = article.id;

  if (!emoji) {
    // Remove existing reaction.
    await prisma.articleReaction.deleteMany({ where: { userId, articleId } });
    res.json({ myReaction: null });
    return;
  }

  // Upsert: insert or change emoji.
  await prisma.articleReaction.upsert({
    where: { userId_articleId: { userId, articleId } },
    create: { userId, articleId, emoji },
    update: { emoji },
  });

  res.json({ myReaction: emoji });
}
