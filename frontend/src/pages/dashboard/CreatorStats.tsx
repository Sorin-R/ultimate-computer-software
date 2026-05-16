import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import VerifiedBadge from "../../components/VerifiedBadge";

/**
 * Dashboard → Creator Stats (C4).
 *
 * Shows the creator their key numbers: total followers, growth in the last
 * 30 days, follower-vs-non-follower reads, top-performing articles, and a
 * tiny inline 30-day growth bar chart (CSS only, no chart lib).
 */

interface Stats {
  totals: {
    followers: number;
    followersLast30Days: number;
    verifiedTier: "verified" | "top" | null;
    publishedArticles: number;
    readsFromFollowers: number;
    readsFromOthers: number;
  };
  dailyGrowth: { date: string; count: number }[];
  topArticles: {
    id: string;
    title: string;
    slug: string;
    publishedAt: string | null;
    views: number;
  }[];
}

export default function CreatorStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/me/creator-stats")
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-neutral-500">Failed to load stats.</p>;
  }

  const totalReads =
    stats.totals.readsFromFollowers + stats.totals.readsFromOthers;
  const followerSharePct =
    totalReads > 0
      ? Math.round((stats.totals.readsFromFollowers / totalReads) * 100)
      : 0;

  // Simple inline bar chart — height per bar = count / max * 100%.
  const maxDay = Math.max(1, ...stats.dailyGrowth.map((d) => d.count));

  return (
    <>
      <SEOHead title="Creator Stats" />
      <h1 className="text-3xl font-bold mb-6 [font-family:Georgia,'Times_New_Roman',serif] flex items-center gap-2">
        Creator Stats
        <VerifiedBadge tier={stats.totals.verifiedTier} size={20} />
      </h1>

      {/* Totals row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Stat label="Followers" value={stats.totals.followers.toLocaleString()} />
        <Stat
          label="New (30 days)"
          value={`+${stats.totals.followersLast30Days}`}
        />
        <Stat
          label="Articles"
          value={stats.totals.publishedArticles.toLocaleString()}
        />
        <Stat
          label="Total reads"
          value={totalReads.toLocaleString()}
        />
      </div>

      {/* Reads breakdown */}
      <div className="bg-white border border-black/15 p-4 mb-8">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-[0.08em] text-neutral-700">
          Reads from followers
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-4 bg-neutral-100 overflow-hidden rounded">
            <div
              className="h-full bg-[#b5121b]"
              style={{ width: `${followerSharePct}%` }}
              title={`${followerSharePct}% from followers`}
            />
          </div>
          <span className="text-sm font-semibold w-16 text-right">
            {followerSharePct}%
          </span>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          {stats.totals.readsFromFollowers.toLocaleString()} from followers ·{" "}
          {stats.totals.readsFromOthers.toLocaleString()} from others
        </p>
      </div>

      {/* Daily growth chart */}
      <div className="bg-white border border-black/15 p-4 mb-8">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-[0.08em] text-neutral-700">
          New followers — last 30 days
        </h2>
        <div className="flex items-end gap-px h-32">
          {stats.dailyGrowth.map((d) => (
            <div
              key={d.date}
              className="flex-1 bg-[#b5121b] hover:bg-[#8f0f16] transition-colors min-h-[1px]"
              style={{ height: `${(d.count / maxDay) * 100}%` }}
              title={`${d.date}: +${d.count}`}
            />
          ))}
        </div>
        <p className="text-[11px] text-neutral-400 mt-2 flex justify-between">
          <span>{stats.dailyGrowth[0]?.date}</span>
          <span>{stats.dailyGrowth[stats.dailyGrowth.length - 1]?.date}</span>
        </p>
      </div>

      {/* Top articles */}
      <div className="bg-white border border-black/15 p-4">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-[0.08em] text-neutral-700">
          Top articles by views
        </h2>
        {stats.topArticles.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">No articles yet.</p>
        ) : (
          <ol className="space-y-2">
            {stats.topArticles.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <span className="font-bold w-6 text-neutral-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  to={`/${a.slug}`}
                  className="flex-1 truncate hover:text-[#b5121b]"
                >
                  {a.title}
                </Link>
                <span className="text-neutral-500 text-xs">
                  {a.views.toLocaleString()} reads
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-black/15 p-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
        {value}
      </p>
    </div>
  );
}
