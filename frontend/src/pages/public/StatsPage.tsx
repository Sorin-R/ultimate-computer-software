import { useEffect, useState } from "react";
import SEOHead from "../../components/SEOHead";
import api from "../../api/client";

interface StatsPayload {
  totals: {
    publishedArticles: number;
    creators: number;
    readsThisWeek: number;
    comments: number;
  };
  topCategories: Array<{
    id: string;
    name: string;
    slug: string;
    articleCount: number;
  }>;
  newestCreators: Array<{
    id: string;
    name: string;
    createdAt: string;
    avatarUrl: string | null;
    _count: { articles: number };
  }>;
  generatedAt: string;
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/stats")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SEOHead
        title="Community Stats"
        description="Live public community metrics: published articles, creators, weekly reads and category trends."
        path="/stats"
      />
      <main className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-8">Community Stats</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
          </div>
        ) : !stats ? (
          <p className="text-neutral-500">Unable to load community stats right now.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Published Articles" value={stats.totals.publishedArticles} />
              <StatCard label="Creators" value={stats.totals.creators} />
              <StatCard label="Reads This Week" value={stats.totals.readsThisWeek} />
              <StatCard label="Visible Comments" value={stats.totals.comments} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white border border-black/15 p-5">
                <h2 className="text-xl font-semibold mb-3">Top Categories This Week</h2>
                {stats.topCategories.length === 0 ? (
                  <p className="text-sm text-neutral-500">No category trend data yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {stats.topCategories.map((category) => (
                      <li key={category.id} className="flex justify-between text-sm border-b border-black/10 pb-2">
                        <span>{category.name}</span>
                        <strong>{category.articleCount}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-white border border-black/15 p-5">
                <h2 className="text-xl font-semibold mb-3">Newest Creators</h2>
                {stats.newestCreators.length === 0 ? (
                  <p className="text-sm text-neutral-500">No creator data available.</p>
                ) : (
                  <ul className="space-y-2">
                    {stats.newestCreators.map((creator) => (
                      <li key={creator.id} className="flex justify-between text-sm border-b border-black/10 pb-2">
                        <span>{creator.name}</span>
                        <span className="text-neutral-500">{creator._count.articles} articles</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <p className="text-xs text-neutral-500 mt-6">Last updated: {new Date(stats.generatedAt).toLocaleString()}</p>
          </>
        )}
      </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="bg-white border border-black/15 p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-neutral-500">{label}</p>
      <p className="text-3xl font-bold text-neutral-900 mt-1">{value.toLocaleString()}</p>
    </article>
  );
}
