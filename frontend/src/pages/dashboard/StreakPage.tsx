/**
 * R4: Streak + badges dashboard page.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import StreakBanner from "../../components/StreakBanner";

interface Badge {
  code: string;
  label: string;
  description: string;
  icon: string;
  family?: "reader" | "creator";
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

export default function StreakPage() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<StreakData>("/me/streak")
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SEOHead title="Reading Streak & Badges" path="/dashboard/streaks" />
      <div className="mb-6">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
          Reading Streak & Badges
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          Read at least one article every day to build a streak and unlock badges.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : !data ? (
        <p className="text-neutral-500 text-center py-10">Could not load streak data.</p>
      ) : (
        <>
          <StreakBanner variant="full" />

          <h2 className="text-xl font-bold mt-10 mb-4 [font-family:Georgia,'Times_New_Roman',serif]">
            Badges{" "}
            <span className="text-sm font-medium text-neutral-500 ml-1">
              ({data.earnedCount} / {data.totalCount})
            </span>
          </h2>

          {/* K8: split badges by reader vs creator family for clarity. */}
          {(["reader", "creator"] as const).map((fam) => {
            const fams = data.badges.filter((b) => (b.family ?? "reader") === fam);
            if (fams.length === 0) return null;
            return (
              <section key={fam} className="mb-8">
                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500 mb-3">
                  {fam === "reader" ? "Reader achievements" : "Creator achievements"}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {fams.map((badge) => (
                    <div
                      key={badge.code}
                      className={`p-4 border rounded-lg text-center transition-all ${
                        badge.earned
                          ? "bg-white border-amber-300 shadow-sm"
                          : "bg-neutral-50 border-black/10 opacity-60 grayscale"
                      }`}
                      title={badge.description}
                    >
                      <div className="text-4xl mb-2" aria-hidden>{badge.icon}</div>
                      <div className="font-semibold text-neutral-900 text-sm leading-tight">
                        {badge.label}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">{badge.description}</div>
                      {badge.earned && badge.earnedAt && (
                        <div className="text-[10px] text-amber-700 mt-2 font-semibold">
                          Earned {new Date(badge.earnedAt).toLocaleDateString()}
                        </div>
                      )}
                      {!badge.earned && (
                        <div className="text-[10px] text-neutral-400 mt-2 uppercase tracking-wide">
                          Locked
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="mt-10 bg-neutral-50 border border-black/10 rounded-lg p-5 text-sm text-neutral-700">
            <h3 className="font-semibold mb-2">How streaks work</h3>
            <ul className="space-y-1.5 text-xs text-neutral-600 list-disc pl-4">
              <li>Read at least one article each day to extend your streak.</li>
              <li>The streak counts consecutive UTC days; if you skip a day, it resets to 0.</li>
              <li>Your longest streak ever is preserved even after a reset.</li>
              <li>Badges unlock automatically when you cross a threshold.</li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
