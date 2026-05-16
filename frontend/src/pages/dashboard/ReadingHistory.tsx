import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { hasReadyAudio, type ArticleAudioStatus } from "../../utils/articleAudio";
import { getImageUrl } from "../../utils/imageUrl";
import { History, Clock } from "lucide-react";
import ArticleListenBadge from "../../components/ArticleListenBadge";

interface HistoryItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  publishedAt: string | null;
  viewedAt: string;
  timeRange: string; // "0-1", "1-5", "5+"
  category: { name: string; slug: string };
}

const TIME_RANGE_LABEL: Record<string, string> = {
  "0-1": "< 1 min",
  "1-5": "1–5 min",
  "5+":  "5+ min",
};

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function ReadingHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback((p: number) => {
    setLoading(true);
    api
      .get(`/articles/me/history?page=${p}&limit=20`)
      .then((r) => {
        setItems(r.data.history);
        setTotalPages(r.data.pagination.totalPages);
        setTotal(r.data.pagination.total);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1); }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <History size={22} className="text-[#b5121b]" />
        <h1 className="text-2xl font-bold text-neutral-900 [font-family:Georgia,'Times_New_Roman',serif]">
          Reading History
        </h1>
      </div>
      {!loading && total > 0 && (
        <p className="text-sm text-neutral-500 mb-6">
          {total} article{total !== 1 ? "s" : ""} read
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <History size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No reading history yet</p>
          <p className="text-sm">Articles you read will appear here.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.slug}
                className="flex gap-4 bg-white border border-black/10 p-4 hover:border-black/20 transition-colors"
              >
                {item.imageUrl && (
                  <Link to={`/${item.slug}`} className="relative shrink-0 w-20 h-14 overflow-hidden rounded">
                    {hasReadyAudio(item) && <ArticleListenBadge size="sm" className="left-1 top-1" />}
                    <img
                      src={getImageUrl(item.imageUrl) ?? ""}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#b5121b] uppercase tracking-wider mb-0.5">
                    {item.category.name}
                  </p>
                  <Link
                    to={`/${item.slug}`}
                    className="text-sm font-semibold text-neutral-900 hover:text-[#b5121b] transition-colors line-clamp-2 [font-family:Georgia,'Times_New_Roman',serif]"
                  >
                    {item.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-neutral-400">
                    <span>{item.authorName}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {TIME_RANGE_LABEL[item.timeRange] ?? item.timeRange}
                    </span>
                    <span>· {formatRelative(item.viewedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                disabled={page === 1}
                onClick={() => load(page - 1)}
                className="px-4 py-2 border border-black/20 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-neutral-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => load(page + 1)}
                className="px-4 py-2 border border-black/20 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
