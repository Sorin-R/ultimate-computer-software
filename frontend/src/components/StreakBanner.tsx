/**
 * R4: Reading streak banner — shown on the dashboard home and the streaks page.
 * Compact mode shows the current streak number and a flame icon.
 * Full mode adds total reads, longest streak, and a badge progress strip.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

interface Badge {
  code: string;
  label: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string | null;
  totalReads: number;
  badges: Badge[];
  earnedCount: number;
  totalCount: number;
}

interface Props {
  variant?: "compact" | "full";
}

export default function StreakBanner({ variant = "compact" }: Props) {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<StreakData>("/me/streak")
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-black/15 rounded p-4 flex items-center gap-3">
        <div className="animate-pulse h-10 w-10 bg-neutral-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="animate-pulse h-3 bg-neutral-200 rounded w-1/3" />
          <div className="animate-pulse h-3 bg-neutral-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const streak = data.currentStreak;
  const flameIntensity = streak === 0 ? "🔥" : streak >= 30 ? "🔥🔥🔥" : streak >= 7 ? "🔥🔥" : "🔥";

  if (variant === "compact") {
    return (
      <Link
        to="/dashboard/streaks"
        className="block bg-gradient-to-br from-orange-50 to-amber-50 border border-amber-200 rounded p-4 hover:border-amber-300 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>{flameIntensity}</span>
            <div>
              <div className="font-bold text-neutral-900 text-lg leading-tight">
                {streak === 0 ? "Start a streak today" : `${streak}-day streak`}
              </div>
              <div className="text-xs text-neutral-600">
                {streak === 0
                  ? "Read an article to begin"
                  : streak === 1
                  ? "Read again tomorrow to keep it going"
                  : `Longest: ${data.longestStreak} day${data.longestStreak !== 1 ? "s" : ""} · ${data.totalReads} total reads`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-amber-700">
              {data.earnedCount}/{data.totalCount}
            </div>
            <div className="text-[10px] text-amber-600 uppercase tracking-wide">badges</div>
          </div>
        </div>
      </Link>
    );
  }

  // Full variant
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-amber-200 rounded-lg p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-5xl" aria-hidden>{flameIntensity}</span>
          <div>
            <div className="text-3xl font-bold text-neutral-900 leading-tight">
              {streak} day{streak !== 1 ? "s" : ""}
            </div>
            <div className="text-sm text-neutral-700">Current reading streak</div>
            {streak === 0 && (
              <p className="text-xs text-neutral-600 mt-1">
                Read any article today to start a new streak.
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-amber-700">{data.longestStreak}</div>
            <div className="text-[11px] uppercase tracking-wide text-amber-700">Longest</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700">{data.totalReads}</div>
            <div className="text-[11px] uppercase tracking-wide text-amber-700">Total reads</div>
          </div>
        </div>
      </div>
    </div>
  );
}
