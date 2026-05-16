import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

function formatAvgTime(minutes: number, seconds?: number): string {
  if (minutes < 1 && seconds) {
    return `${seconds}s`;
  }
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  return `${minutes.toFixed(1)}m`;
}

interface Stats {
  totalArticles: number;
  pendingArticles: number;
  publishedArticles: number;
  totalUsers: number;
  totalCategories: number;
  totalViews?: number;
  averageTimeSeconds?: number;
  averageTimeMinutes?: number;
}

interface PopularArticle {
  id: string;
  title: string;
  slug: string;
  publishedAt: string;
  _count: { views: number };
}

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [popularArticles, setPopularArticles] = useState<PopularArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/articles/popularity"),
    ])
      .then(([statsRes, articlesRes]) => {
        setStats(statsRes.data);
        setPopularArticles(articlesRes.data.articles);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: "Total Articles", value: stats.totalArticles, to: "/admin/articles" },
    { label: "Pending Review", value: stats.pendingArticles, to: "/admin/articles?status=SUBMITTED" },
    { label: "Published", value: stats.publishedArticles, to: "/admin/articles?status=PUBLISHED" },
    { label: "Total Reads", value: stats.totalViews || 0 },
    { label: "Avg. Read Time", value: formatAvgTime(stats.averageTimeMinutes || 0, stats.averageTimeSeconds), isText: true },
    { label: "Users", value: stats.totalUsers, to: "/admin/users" },
    { label: "Categories", value: stats.totalCategories, to: "/admin/categories" },
  ];

  return (
    <>
      <SEOHead title="Admin Dashboard" noindex />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-10">
        {cards.map((card) => {
          const className =
            "bg-white border border-black/15 p-5 min-h-[112px] flex flex-col justify-between" +
            (card.to ? " hover:border-black/35 transition-colors cursor-pointer" : "");

          const valueText =
            typeof card.value === "string" ? card.value : card.value.toLocaleString();

          if (card.to) {
            return (
              <Link key={card.label} to={card.to} className={className}>
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-500 leading-tight min-h-[2.1rem]">
                  {card.label}
                </p>
                <p className="text-3xl font-bold text-neutral-900 leading-none whitespace-nowrap tabular-nums">
                  {valueText}
                </p>
              </Link>
            );
          }

          return (
            <div key={card.label} className={className}>
              <p className="text-xs uppercase tracking-[0.08em] text-neutral-500 leading-tight min-h-[2.1rem]">
                {card.label}
              </p>
              <p className="text-3xl font-bold text-neutral-900 leading-none whitespace-nowrap tabular-nums">
                {valueText}
              </p>
            </div>
          );
        })}
      </div>

      {/* Most Read Articles */}
      <div className="bg-white border border-black/15 p-6">
        <h2 className="text-xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
          Top 10 Most Read Articles
        </h2>
        {popularArticles.length === 0 ? (
          <p className="text-neutral-500 text-sm">No articles have been read yet.</p>
        ) : (
          <div className="space-y-3">
            {popularArticles.map((article, index) => (
              <div key={article.id} className="flex items-center justify-between py-3 border-b border-black/10 last:border-b-0">
                <div>
                  <p className="font-semibold text-neutral-900">#{index + 1}</p>
                  <Link to={`/${article.slug}`} className="text-[#b5121b] hover:text-[#8f0f16] hover:underline text-sm">
                    {article.title}
                  </Link>
                </div>
                <div className="text-right">
                  <p className="font-bold text-neutral-900">{article._count.views.toLocaleString()}</p>
                  <p className="text-xs text-neutral-500">reads</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
