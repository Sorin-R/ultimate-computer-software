import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  category: { name: string; slug: string };
}

export default function MyArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/articles/mine")
      .then((res) => setArticles(res.data.articles))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    try {
      await api.delete(`/articles/${id}`);
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete");
    }
  };

  return (
    <>
      <SEOHead title="My Articles" path="/dashboard/articles" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">My Articles</h1>
        <Link
          to="/dashboard/articles/new"
          className="px-4 py-2 bg-black text-white hover:bg-neutral-800 text-xs font-semibold uppercase tracking-[0.08em]"
        >
          New Article
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : articles.length === 0 ? (
        <p className="text-neutral-500 text-center py-10">No articles yet.</p>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => {
            const canEdit = true;
            return (
              <div
                key={article.id}
                className="bg-white border border-black/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <StatusBadge status={article.status} />
                    <span className="text-xs text-neutral-500 uppercase tracking-[0.07em]">{article.category.name}</span>
                    {article.status === "SUBMITTED" && (
                      <span className="text-xs text-amber-700 font-medium">
                        Under editorial review. Typical review time: up to 24 hours.
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-neutral-900 truncate">{article.title}</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {article.status === "PUBLISHED" && article.publishedAt
                      ? `Published ${new Date(article.publishedAt).toLocaleDateString()}`
                      : `Updated ${new Date(article.updatedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canEdit && (
                    <Link
                      to={`/dashboard/articles/edit/${article.id}`}
                      className="px-3 py-1.5 text-sm border border-black/25 hover:bg-neutral-50 text-neutral-700"
                    >
                      Edit
                    </Link>
                  )}
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="px-3 py-1.5 text-sm text-red-700 border border-red-200 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
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
    SCHEDULED: "bg-blue-100 text-blue-700",
  };
  const labels: Record<string, string> = {
    SUBMITTED: "UNDER REVIEW",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.DRAFT}`}>
      {labels[status] || status}
    </span>
  );
}
