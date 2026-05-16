/**
 * K9: Tag Feed — articles from tags the user follows.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import ArticleCard from "../../components/ArticleCard";
import type { ArticleAudioStatus } from "../../utils/articleAudio";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  publishedAt: string | null;
  category: { name: string; slug: string };
}

export default function TagFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get("/tags/feed", { params: { page } })
      .then((res) => {
        setArticles(res.data.articles);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setMessage(res.data.message ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <SEOHead title="My Tag Feed" path="/dashboard/tag-feed" />
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">My Tag Feed</h1>
          {total > 0 && (
            <p className="text-neutral-500 text-sm mt-1">{total} article{total !== 1 ? "s" : ""} from your followed tags</p>
          )}
        </div>
        <Link
          to="/tags"
          className="px-4 py-2 bg-black text-white hover:bg-neutral-800 text-xs font-semibold uppercase tracking-[0.08em]"
        >
          Browse Tags
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : message || articles.length === 0 ? (
        <div className="text-center py-12 bg-white border border-black/15 rounded">
          <p className="text-neutral-500 mb-4">
            {message || "No articles found from your followed tags."}
          </p>
          <Link to="/tags" className="text-[#b5121b] hover:underline text-sm font-semibold">
            Browse topics to follow →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((a) => (
              <ArticleCard key={a.id} {...a} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-neutral-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
