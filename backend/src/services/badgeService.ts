/**
 * K8: Centralized achievement-badge service.
 *
 * One source of truth for:
 *   - Badge metadata (label / description / icon / category)
 *   - Awarding logic (idempotent via UserBadge unique constraint)
 *   - Per-event check helpers called from controllers (createComment,
 *     toggleBookmark, publish article, toggle verified, etc.)
 *
 * Badges fall into two visual families:
 *   - "reader"  — engagement-driven (reads, comments, bookmarks, streak)
 *   - "creator" — authorship-driven (publishing, virality, verified)
 *
 * Awards are always best-effort: failures are logged but never bubble up,
 * because no badge mishap should ever break a user-facing write.
 */
import { BadgeCode } from "@prisma/client";
import prisma from "../config/db";

export type BadgeFamily = "reader" | "creator";

export interface BadgeMetaEntry {
  label: string;
  description: string;
  icon: string;
  family: BadgeFamily;
}

export const BADGE_META: Record<BadgeCode, BadgeMetaEntry> = {
  // ---- Reader: reading & streaks (R4) ----
  FIRST_READ:        { label: "Welcome Reader",   description: "Read your first article",  icon: "👋", family: "reader" },
  CURIOUS_MIND:      { label: "Curious Mind",      description: "Read 10 articles",          icon: "🧠", family: "reader" },
  KNOWLEDGE_SEEKER:  { label: "Knowledge Seeker",  description: "Read 100 articles",         icon: "📚", family: "reader" },
  STREAK_3:          { label: "Getting Into It",   description: "3-day reading streak",      icon: "✨", family: "reader" },
  STREAK_7:          { label: "Week Warrior",      description: "7-day reading streak",      icon: "🔥", family: "reader" },
  STREAK_30:         { label: "Month Master",      description: "30-day reading streak",     icon: "🏆", family: "reader" },
  STREAK_100:        { label: "Century Club",      description: "100-day reading streak",    icon: "💯", family: "reader" },
  COMMUNITY_BUILDER: { label: "Community Builder", description: "Invited a new community member", icon: "🤝", family: "reader" },

  // ---- Reader: engagement (K8) ----
  FIRST_COMMENT:     { label: "First Comment",     description: "Posted your first comment", icon: "💬", family: "reader" },
  CONVERSATIONALIST: { label: "Conversationalist", description: "Posted 10 comments",         icon: "🗣️", family: "reader" },
  DISCUSSION_LEADER: { label: "Discussion Leader", description: "Posted 50 comments",         icon: "🎤", family: "reader" },
  FIRST_BOOKMARK:    { label: "First Bookmark",    description: "Saved your first article",   icon: "🔖", family: "reader" },
  BOOKWORM:          { label: "Bookworm",          description: "Saved 25 articles",           icon: "📑", family: "reader" },
  SUPPORTER:         { label: "Supporter",         description: "Subscribed to 5 authors",     icon: "💛", family: "reader" },

  // ---- Creator (K8) ----
  FIRST_ARTICLE:     { label: "First Article",     description: "Published your first article",  icon: "✍️", family: "creator" },
  PROLIFIC_WRITER:   { label: "Prolific Writer",   description: "Published 10 articles",          icon: "📝", family: "creator" },
  MASTER_AUTHOR:     { label: "Master Author",     description: "Published 50 articles",          icon: "🖋️", family: "creator" },
  VERIFIED_AUTHOR:   { label: "Verified",          description: "Verified by editorial team",     icon: "✅", family: "creator" },
  TRENDING:          { label: "Trending",          description: "Article hit 100 views",          icon: "📈", family: "creator" },
  VIRAL:             { label: "Viral",             description: "Article hit 1,000 views",        icon: "🚀", family: "creator" },
  TOP_CURATOR:       { label: "Top Curator",       description: "Created a reading list with 10+ items", icon: "🗂️", family: "creator" },
};

/**
 * Insert UserBadge rows for the given codes that the user doesn't already
 * own. Returns the codes that were *newly* awarded so callers can display
 * a "you earned X!" toast.
 */
export async function awardBadges(userId: string, codes: BadgeCode[]): Promise<BadgeCode[]> {
  if (codes.length === 0) return [];

  // De-dupe input.
  const wanted = Array.from(new Set(codes));

  const existing = await prisma.userBadge.findMany({
    where: { userId, code: { in: wanted } },
    select: { code: true },
  });
  const existingSet = new Set(existing.map((e) => e.code));
  const toAward = wanted.filter((c) => !existingSet.has(c));

  if (toAward.length === 0) return [];

  await prisma.userBadge.createMany({
    data: toAward.map((code) => ({ userId, code })),
    skipDuplicates: true,
  });

  return toAward;
}

/**
 * Wrap the badge-award side effects so a failed query never breaks the
 * primary write path (creating a comment, publishing an article, etc.).
 */
async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[badges] ${label} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Comment milestones — call after creating a comment. */
export async function checkCommentBadges(userId: string): Promise<BadgeCode[]> {
  return (
    (await safe("checkCommentBadges", async () => {
      const count = await prisma.comment.count({
        where: { userId, status: "VISIBLE" },
      });
      const eligible: BadgeCode[] = [];
      if (count >= 1) eligible.push("FIRST_COMMENT");
      if (count >= 10) eligible.push("CONVERSATIONALIST");
      if (count >= 50) eligible.push("DISCUSSION_LEADER");
      return awardBadges(userId, eligible);
    })) || []
  );
}

/** Bookmark milestones — call after toggling on a bookmark. */
export async function checkBookmarkBadges(userId: string): Promise<BadgeCode[]> {
  return (
    (await safe("checkBookmarkBadges", async () => {
      const count = await prisma.bookmark.count({ where: { userId } });
      const eligible: BadgeCode[] = [];
      if (count >= 1) eligible.push("FIRST_BOOKMARK");
      if (count >= 25) eligible.push("BOOKWORM");
      return awardBadges(userId, eligible);
    })) || []
  );
}

/** Subscription milestones — call after a user subscribes to an author. */
export async function checkSubscriptionBadges(userId: string): Promise<BadgeCode[]> {
  return (
    (await safe("checkSubscriptionBadges", async () => {
      const count = await prisma.subscription.count({ where: { subscriberId: userId } });
      const eligible: BadgeCode[] = [];
      if (count >= 5) eligible.push("SUPPORTER");
      return awardBadges(userId, eligible);
    })) || []
  );
}

/** Author milestones — call when an article transitions to PUBLISHED. */
export async function checkAuthorBadges(userId: string): Promise<BadgeCode[]> {
  return (
    (await safe("checkAuthorBadges", async () => {
      const count = await prisma.article.count({
        where: { userId, status: "PUBLISHED" },
      });
      const eligible: BadgeCode[] = [];
      if (count >= 1) eligible.push("FIRST_ARTICLE");
      if (count >= 10) eligible.push("PROLIFIC_WRITER");
      if (count >= 50) eligible.push("MASTER_AUTHOR");
      return awardBadges(userId, eligible);
    })) || []
  );
}

/** Verified — granted when admin toggles isVerified ON. Idempotent. */
export async function checkVerifiedBadge(userId: string): Promise<BadgeCode[]> {
  return (
    (await safe("checkVerifiedBadge", async () => {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { isVerified: true },
      });
      if (!u?.isVerified) return [];
      return awardBadges(userId, ["VERIFIED_AUTHOR"]);
    })) || []
  );
}

/** Reading list milestones — call when articles are added/removed from a list. */
export async function checkCuratorBadges(userId: string): Promise<BadgeCode[]> {
  return (
    (await safe("checkCuratorBadges", async () => {
      // Find any reading list owned by user with 10+ items.
      const big = await prisma.readingList.findFirst({
        where: {
          userId,
          items: { some: {} },
        },
        select: { _count: { select: { items: true } } },
        orderBy: { items: { _count: "desc" } },
      });
      if (!big || big._count.items < 10) return [];
      return awardBadges(userId, ["TOP_CURATOR"]);
    })) || []
  );
}

/**
 * Article virality — call on each new view if the new total has crossed
 * a virality threshold for that article. We award the badge to the
 * article's author.
 */
export async function checkArticleViralityBadges(articleId: string): Promise<BadgeCode[]> {
  return (
    (await safe("checkArticleViralityBadges", async () => {
      const [article, viewCount] = await Promise.all([
        prisma.article.findUnique({
          where: { id: articleId },
          select: { userId: true },
        }),
        prisma.articleView.count({ where: { articleId } }),
      ]);
      if (!article?.userId) return [];

      const eligible: BadgeCode[] = [];
      if (viewCount >= 100) eligible.push("TRENDING");
      if (viewCount >= 1000) eligible.push("VIRAL");
      if (eligible.length === 0) return [];

      return awardBadges(article.userId, eligible);
    })) || []
  );
}

/**
 * Bulk fetch earned badges for multiple users — used to attach badge
 * lists to feed responses (article cards, comment threads) without N+1s.
 */
export async function getBadgesForUsers(
  userIds: string[]
): Promise<Map<string, BadgeCode[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.userBadge.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, code: true, earnedAt: true },
    orderBy: { earnedAt: "asc" },
  });
  const map = new Map<string, BadgeCode[]>();
  for (const r of rows) {
    const arr = map.get(r.userId) ?? [];
    arr.push(r.code);
    map.set(r.userId, arr);
  }
  return map;
}

/** Small DTO with metadata, suitable for embedding in API responses. */
export interface PublicBadge {
  code: BadgeCode;
  label: string;
  description: string;
  icon: string;
  family: BadgeFamily;
}

export function publicBadge(code: BadgeCode): PublicBadge {
  const meta = BADGE_META[code];
  return { code, ...meta };
}

/**
 * Pick the most "important" badges for a compact display next to a user's
 * name. Order: VERIFIED_AUTHOR > creator > reader; within each, by
 * milestone height (encoded by enum order). Caps at `limit`.
 */
const PRIORITY: BadgeCode[] = [
  "VERIFIED_AUTHOR",
  "VIRAL",
  "TRENDING",
  "MASTER_AUTHOR",
  "PROLIFIC_WRITER",
  "FIRST_ARTICLE",
  "TOP_CURATOR",
  "STREAK_100",
  "STREAK_30",
  "DISCUSSION_LEADER",
  "BOOKWORM",
  "SUPPORTER",
  "KNOWLEDGE_SEEKER",
  "STREAK_7",
  "CONVERSATIONALIST",
  "CURIOUS_MIND",
  "STREAK_3",
  "FIRST_COMMENT",
  "FIRST_BOOKMARK",
  "FIRST_READ",
  "COMMUNITY_BUILDER",
];

export function topBadges(codes: BadgeCode[], limit = 3): PublicBadge[] {
  const set = new Set(codes);
  const ordered: BadgeCode[] = [];
  for (const c of PRIORITY) {
    if (set.has(c)) ordered.push(c);
    if (ordered.length === limit) break;
  }
  return ordered.map(publicBadge);
}
