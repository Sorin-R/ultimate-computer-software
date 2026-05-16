/**
 * K8: Compact badge display for any user.
 *
 * Two display modes:
 *   - "inline"  (default): a row of icon chips with native title-tooltip,
 *     suitable for sitting next to a user's name in a byline / comment.
 *   - "full"  : icon + label list, used on profile pages.
 *
 * Data sources:
 *   - Pass `userId` to fetch from /api/users/:id/badges
 *   - OR pass `badges` directly if the parent already has them (avoids
 *     N+1 fetches on feeds — the parent can batch via getUserBadges
 *     server-side and inject pre-shaped lists).
 */
import { useEffect, useState } from "react";
import api from "../api/client";

export interface UserBadge {
  code: string;
  label: string;
  description: string;
  icon: string;
  family: "reader" | "creator";
  earnedAt?: string | null;
}

// Priority order matches backend topBadges() — VERIFIED_AUTHOR > creator
// achievements > reader achievements. Must stay in sync.
const PRIORITY: string[] = [
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

function rank(code: string): number {
  const i = PRIORITY.indexOf(code);
  return i === -1 ? 999 : i;
}

interface Props {
  /** Fetch badges for this user. */
  userId?: string;
  /** Or supply pre-fetched badges directly. */
  badges?: UserBadge[];
  /** Visual style. */
  variant?: "inline" | "full";
  /** Cap inline display to top-N most important badges. Default 3. */
  limit?: number;
  /** Optional className for outer wrapper. */
  className?: string;
}

export default function UserBadgeList({
  userId,
  badges: externalBadges,
  variant = "inline",
  limit = 3,
  className = "",
}: Props) {
  const [badges, setBadges] = useState<UserBadge[] | null>(externalBadges ?? null);

  useEffect(() => {
    if (externalBadges) {
      setBadges(externalBadges);
      return;
    }
    if (!userId) return;
    let cancelled = false;
    api
      .get<{ badges: UserBadge[] }>(`/users/${userId}/badges`)
      .then((res) => {
        if (!cancelled) setBadges(res.data.badges);
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, externalBadges]);

  if (!badges || badges.length === 0) return null;

  // Sort by priority + cap for inline mode.
  const sorted = [...badges].sort((a, b) => rank(a.code) - rank(b.code));
  const visible = variant === "inline" ? sorted.slice(0, limit) : sorted;
  const overflow = variant === "inline" ? sorted.length - visible.length : 0;

  if (variant === "full") {
    return (
      <ul className={`flex flex-wrap gap-2 ${className}`}>
        {visible.map((b) => (
          <li
            key={b.code}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-black/15 rounded-full text-xs"
            title={b.description}
          >
            <span aria-hidden="true">{b.icon}</span>
            <span className="font-medium text-neutral-800">{b.label}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {visible.map((b) => (
        <span
          key={b.code}
          title={`${b.label} — ${b.description}`}
          aria-label={b.label}
          className="inline-flex items-center justify-center w-5 h-5 text-[13px] leading-none cursor-help select-none"
        >
          {b.icon}
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={`+${overflow} more badge${overflow === 1 ? "" : "s"}`}
          className="text-[10px] font-semibold text-neutral-500 ml-0.5"
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
