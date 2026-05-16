import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { hasReadyAudio, type ArticleAudioStatus } from "../../utils/articleAudio";
import { getImageUrl } from "../../utils/imageUrl";
import { Bookmark, Trash2 } from "lucide-react";
import ArticleListenBadge from "../../components/ArticleListenBadge";

interface BookmarkItem {
  id: string;
  createdAt: string;
  article: {
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
  };
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function MyBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(
    (p: number) => {
      setLoading(true);
      api
        .get(`/bookmarks?page=${p}&limit=20`)
        .then((r) => {
          setBookmarks(r.data.bookmarks);
          setTotalPages(r.data.pagination.totalPages);
          setPage(p);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => { load(1); }, [load]);

  const remove = async (articleId: string) => {
    setRemoving((s) => new Set(s).add(articleId));
    try {
      await api.post("/bookmarks", { articleId });
      setBookmarks((prev) => prev.filter((b) => b.article.id !== articleId));
    } catch {
      // ignore
    } finally {
      setRemoving((s) => { const n = new Set(s); n.delete(articleId); return n; });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Bookmark size={22} className="text-[#b5121b]" />
        <h1 className="text-2xl font-bold text-neutral-900 [font-family:Georgia,'Times_New_Roman',serif]">
          Bookmarks
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <Bookmark size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No bookmarks yet</p>
          <p className="text-sm">Click the bookmark icon on any article to save it here.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {bookmarks.map((b) => (
              <div
                key={b.id}
                className="flex gap-4 bg-white border border-black/10 p-4 hover:border-black/20 transition-colors"
              >
                {b.article.imageUrl && (
                  <Link to={`/${b.article.slug}`} className="relative shrink-0 w-24 h-16 overflow-hidden rounded">
                    {hasReadyAudio(b.article) && <ArticleListenBadge size="sm" className="left-1 top-1" />}
                    <img
                      src={getImageUrl(b.article.imageUrl) ?? ""}
                      alt={b.article.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#b5121b] uppercase tracking-wider mb-1">
                    {b.article.category.name}
                  </p>
                  <Link
                    to={`/${b.article.slug}`}
                    className="text-base font-semibold text-neutral-900 hover:text-[#b5121b] transition-colors line-clamp-2 [font-family:Georgia,'Times_New_Roman',serif]"
                  >
                    {b.article.title}
                  </Link>
                  {b.article.excerpt && (
                    <p className="text-sm text-neutral-500 line-clamp-1 mt-0.5">{b.article.excerpt}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
                    <span>{b.article.authorName}</span>
                    {b.article.publishedAt && (
                      <span>· {formatDate(b.article.publishedAt)}</span>
                    )}
                    <span>· Saved {formatDate(b.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => remove(b.article.id)}
                  disabled={removing.has(b.article.id)}
                  className="shrink-0 p-2 text-neutral-400 hover:text-red-600 transition-colors"
                  title="Remove bookmark"
                  aria-label="Remove bookmark"
                >
                  <Trash2 size={16} />
                </button>
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
