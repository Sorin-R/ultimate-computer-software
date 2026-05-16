import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import SEOHead from "../../components/SEOHead";
import AdBanner from "../../components/AdBanner";
import StreakBanner from "../../components/StreakBanner";

function formatAvgTime(minutes: number, seconds?: number): string {
  if (minutes < 1 && seconds) {
    return `${seconds}s`;
  }
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  return `${minutes.toFixed(1)}m`;
}

interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  updatedAt: string;
  views?: { totalViews: number; uniqueViews: number };
}

interface ArticleStats {
  totalViews: number;
  uniqueViews: number;
  averageTimeSeconds: number;
  averageTimeMinutes: number;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [articleStats, setArticleStats] = useState<Record<string, ArticleStats>>({});

  useEffect(() => {
    api
      .get("/articles/mine")
      .then((res) => {
        setArticles(res.data.articles);
        // Fetch view stats for published articles
        const publishedArticles = res.data.articles.filter((a: ArticleSummary) => a.status === "PUBLISHED");
        publishedArticles.forEach((article: ArticleSummary) => {
          api
            .get(`/articles/${article.id}/stats`)
            .then((statsRes) => {
              setArticleStats((prev) => ({
                ...prev,
                [article.id]: {
                  totalViews: statsRes.data.totalViews,
                  uniqueViews: statsRes.data.uniqueViews,
                  averageTimeSeconds: statsRes.data.averageTimeSeconds,
                  averageTimeMinutes: statsRes.data.averageTimeMinutes,
                },
              }));
            })
            .catch(console.error);
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = articles.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      <SEOHead title="Dashboard" path="/dashboard" noindex />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Welcome, {user?.name}
      </h1>

      {/* R4: Reading streak banner */}
      <div className="mb-6">
        <StreakBanner variant="compact" />
      </div>

      <div className="mb-8 pb-6 border-b border-black/10">
        <h3 className="text-sm uppercase tracking-[0.08em] text-neutral-500 font-semibold mb-3">Legal</h3>
        <div className="flex flex-wrap gap-4">
          <Link to="/privacy-policy" className="text-sm text-[#b5121b] hover:text-[#8f0f16] underline">
            Privacy Policy
          </Link>
          <Link to="/terms-of-service" className="text-sm text-[#b5121b] hover:text-[#8f0f16] underline">
            Terms of Service
          </Link>
          <Link to="/cookies-policy" className="text-sm text-[#b5121b] hover:text-[#8f0f16] underline">
            Cookies Policy
          </Link>
          <Link to="/data-request" className="text-sm text-[#b5121b] hover:text-[#8f0f16] underline">
            Data Request
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", count: articles.length },
          { label: "Drafts", count: statusCounts["DRAFT"] || 0 },
          { label: "Submitted", count: statusCounts["SUBMITTED"] || 0 },
          { label: "Published", count: statusCounts["PUBLISHED"] || 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-black/15 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-neutral-500">{stat.label}</p>
            <p className="text-3xl font-bold text-neutral-900">{stat.count}</p>
          </div>
        ))}
      </div>

      <AdBanner placement="dashboard" className="mb-8" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">Recent Articles</h2>
        <Link
          to="/dashboard/articles/new"
          className="text-xs px-4 py-2 bg-black text-white hover:bg-neutral-800 font-semibold uppercase tracking-[0.08em]"
        >
          New Article
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : articles.length === 0 ? (
        <p className="text-neutral-500 py-8 text-center">You haven't created any articles yet.</p>
      ) : (
        <div className="bg-white border border-black/15 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Title</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Reads</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Avg. Time</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Updated</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {articles.slice(0, 10).map((article) => (
                <tr key={article.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-900">{article.title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={article.status} />
                  </td>
                  <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">
                    {article.status === "PUBLISHED" && articleStats[article.id]
                      ? articleStats[article.id].totalViews.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">
                    {article.status === "PUBLISHED" && articleStats[article.id]
                      ? formatAvgTime(articleStats[article.id].averageTimeMinutes, articleStats[article.id].averageTimeSeconds)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">
                    {new Date(article.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {article.status === "PUBLISHED" ? (
                      <Link
                        to={`/${article.slug}`}
                        className="inline-flex px-3 py-1.5 text-xs sm:text-sm text-blue-700 border border-blue-200 hover:bg-blue-50"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-400">Not published</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-neutral-100 text-neutral-700",
    SUBMITTED: "bg-amber-100 text-amber-700",
    APPROVED: "bg-[#b5121b]/10 text-[#8f0f16]",
    PUBLISHED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.DRAFT}`}>
      {status}
    </span>
  );
}
