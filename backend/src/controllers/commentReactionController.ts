/**
 * K7: Emoji reactions on comments.
 * One reaction per (user, comment). Calling the endpoint again with a different
 * emoji changes the reaction; calling with the same emoji removes it (toggle).
 */
import { Request, Response } from "express";
import { ReactionEmoji } from "@prisma/client";
import prisma from "../config/db";
import { param } from "../utils/params";

const VALID_EMOJIS: ReactionEmoji[] = ["LIKE", "LOVE", "WOW", "THINK", "HUNDRED", "QUESTION"];

const EMOJI_MAP: Record<ReactionEmoji, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  WOW: "🤯",
  THINK: "🤔",
  HUNDRED: "💯",
  QUESTION: "❓",
};

/** GET /api/comments/:id/reactions — public, returns counts + current user's reaction. */
export async function getCommentReactions(req: Request, res: Response): Promise<void> {
  const commentId = param(req.params.id);
  const currentUserId = req.user?.userId ?? null;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, status: true },
  });
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  const rawCounts = await prisma.commentReaction.groupBy({
    by: ["emoji"],
    where: { commentId },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const r of rawCounts) {
    counts[r.emoji] = r._count._all;
  }

  let myReaction: string | null = null;
  if (currentUserId) {
    const mine = await prisma.commentReaction.findUnique({
      where: { userId_commentId: { userId: currentUserId, commentId } },
      select: { emoji: true },
    });
    myReaction = mine?.emoji ?? null;
  }

  res.json({ counts, myReaction, emojis: EMOJI_MAP });
}

/** POST /api/comments/:id/react — toggle or change reaction. */
export async function reactToComment(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const commentId = param(req.params.id);
  const emojiRaw = (req.body as { emoji?: unknown }).emoji;

  if (!VALID_EMOJIS.includes(emojiRaw as ReactionEmoji)) {
    res.status(400).json({ error: "Invalid emoji", valid: VALID_EMOJIS });
    return;
  }
  const emoji = emojiRaw as ReactionEmoji;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, status: true },
  });
  if (!comment || comment.status !== "VISIBLE") {
    res.status(404).json({ error: "Comment not found or not visible" });
    return;
  }

  const existing = await prisma.commentReaction.findUnique({
    where: { userId_commentId: { userId, commentId } },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      // Same emoji → toggle off
      await prisma.commentReaction.delete({ where: { id: existing.id } });
    } else {
      // Different emoji → change
      await prisma.commentReaction.update({
        where: { id: existing.id },
        data: { emoji, updatedAt: new Date() },
      });
    }
  } else {
    await prisma.commentReaction.create({ data: { commentId, userId, emoji } });
  }

  // Return fresh counts so the frontend can update optimistically.
  const rawCounts = await prisma.commentReaction.groupBy({
    by: ["emoji"],
    where: { commentId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rawCounts) counts[r.emoji] = r._count._all;

  const mine = await prisma.commentReaction.findUnique({
    where: { userId_commentId: { userId, commentId } },
    select: { emoji: true },
  });

  res.json({ counts, myReaction: mine?.emoji ?? null });
}
