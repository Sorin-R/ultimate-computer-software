/**
 * R4: Reading streaks + small badges.
 *
 * Streak rule: a "reading day" is any UTC date on which the user has at least
 * one ArticleView record. The current streak is the count of consecutive days
 * (including today, or yesterday if today has no reads yet) ending at the most
 * recent reading day.
 *
 * Badges are awarded on these thresholds, idempotent:
 *   FIRST_READ          — totalReads >= 1
 *   CURIOUS_MIND        — totalReads >= 10
 *   KNOWLEDGE_SEEKER    — totalReads >= 100
 *   STREAK_3 / 7 / 30 / 100 — currentStreak >= N
 *
 * Stats are cached in `UserStreakStats` and recomputed inside
 * `updateStreakOnRead` (called from recordArticleView).
 */
import { Request, Response } from "express";
import { BadgeCode } from "@prisma/client";
import prisma from "../config/db";
import { BADGE_META, awardBadges } from "../services/badgeService";

/** Convert a Date to a YYYY-MM-DD string in UTC. */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Day delta between two YYYY-MM-DD keys (b - a). */
function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Recompute streak stats for a user from their ArticleView history. Called
 * from `recordArticleView` after a new view is recorded; also called on
 * demand by GET /me/streak so stale stats self-heal.
 *
 * Strategy: pull distinct read-dates (descending). The current streak is the
 * count of consecutive days starting from the most recent date IF that date
 * is today or yesterday (otherwise streak is 0).
 */
export async function recomputeStreakStats(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastReadDate: Date | null;
  totalReads: number;
}> {
  // Pull all view createdAt for this user. For very heavy readers we could
  // limit to the past N days, but article-views are sparse enough that this
  // stays fast in practice; we read createdAt only.
  const views = await prisma.articleView.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (views.length === 0) {
    await prisma.userStreakStats.upsert({
      where: { userId },
      create: { userId, currentStreak: 0, longestStreak: 0, totalReads: 0 },
      update: { currentStreak: 0, totalReads: 0 },
    });
    return { currentStreak: 0, longestStreak: 0, lastReadDate: null, totalReads: 0 };
  }

  // De-duplicate by date.
  const dates: string[] = [];
  const seen = new Set<string>();
  for (const v of views) {
    const k = dateKey(v.createdAt);
    if (!seen.has(k)) {
      seen.add(k);
      dates.push(k);
    }
  }
  // dates[0] is the most recent reading day.

  const today = dateKey(new Date());
  const yesterday = dateKey(new Date(Date.now() - 86_400_000));

  // Current streak: only counts if last read was today or yesterday.
  let currentStreak = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      if (daysBetween(dates[i], dates[i - 1]) === 1) currentStreak++;
      else break;
    }
  }

  // Longest streak: walk all dates and find the longest consecutive run.
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i], dates[i - 1]) === 1) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 1;
    }
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  const lastReadDate = new Date(dates[0] + "T00:00:00Z");
  const totalReads = views.length;

  await prisma.userStreakStats.upsert({
    where: { userId },
    create: { userId, currentStreak, longestStreak, lastReadDate, totalReads },
    update: { currentStreak, longestStreak, lastReadDate, totalReads },
  });

  return { currentStreak, longestStreak, lastReadDate, totalReads };
}

/** Award any badges the user newly qualifies for. Idempotent (unique constraint). */
export async function awardEarnedBadges(
  userId: string,
  totalReads: number,
  currentStreak: number
): Promise<BadgeCode[]> {
  const eligible: BadgeCode[] = [];
  if (totalReads >= 1) eligible.push("FIRST_READ");
  if (totalReads >= 10) eligible.push("CURIOUS_MIND");
  if (totalReads >= 100) eligible.push("KNOWLEDGE_SEEKER");
  if (currentStreak >= 3) eligible.push("STREAK_3");
  if (currentStreak >= 7) eligible.push("STREAK_7");
  if (currentStreak >= 30) eligible.push("STREAK_30");
  if (currentStreak >= 100) eligible.push("STREAK_100");

  return awardBadges(userId, eligible);
}

/**
 * Convenience helper called from recordArticleView.
 * Recomputes stats + awards any newly-earned badges.
 * Returns the badges awarded *this call* so the API can flash them.
 */
export async function updateStreakOnRead(userId: string): Promise<{
  stats: { currentStreak: number; longestStreak: number; totalReads: number };
  newBadges: BadgeCode[];
}> {
  const stats = await recomputeStreakStats(userId);
  const newBadges = await awardEarnedBadges(userId, stats.totalReads, stats.currentStreak);
  return {
    stats: {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      totalReads: stats.totalReads,
    },
    newBadges,
  };
}

// ---------- HTTP endpoints ----------

/** GET /api/me/streak — current streak + longest + last read + earned badges. */
export async function getMyStreak(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  // Recompute on read so stats self-heal if cron / app restarts missed events.
  const stats = await recomputeStreakStats(userId);

  const earned = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
  });
  const earnedCodes = new Set(earned.map((b) => b.code));

  // Build a complete badge catalogue with earned/unearned state.
  const allCodes = Object.keys(BADGE_META) as BadgeCode[];
  const badges = allCodes.map((code) => {
    const meta = BADGE_META[code];
    const e = earned.find((b) => b.code === code);
    return {
      code,
      label: meta.label,
      description: meta.description,
      icon: meta.icon,
      family: meta.family,
      earned: earnedCodes.has(code),
      earnedAt: e?.earnedAt ?? null,
    };
  });

  res.json({
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    lastReadDate: stats.lastReadDate,
    totalReads: stats.totalReads,
    badges,
    earnedCount: earned.length,
    totalCount: allCodes.length,
  });
}

/**
 * K8: GET /api/users/:id/badges — earned badges for any user, with metadata,
 * for display next to their name. Public (no auth).
 */
export async function getUserBadges(req: Request, res: Response): Promise<void> {
  const userId = typeof req.params.id === "string" ? req.params.id : "";
  if (!userId) {
    res.status(400).json({ error: "User id required" });
    return;
  }

  const earned = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "asc" },
  });

  const badges = earned.map((b) => {
    const meta = BADGE_META[b.code];
    return {
      code: b.code,
      label: meta.label,
      description: meta.description,
      icon: meta.icon,
      family: meta.family,
      earnedAt: b.earnedAt,
    };
  });

  res.json({ badges, total: badges.length });
}
