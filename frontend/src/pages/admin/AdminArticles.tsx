import { Fragment, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { useAuth } from "../../context/AuthContext";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  authorName: string;
  originalSourceUrl: string | null;
  audioUrl: string | null;
  audioStatus: "NONE" | "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
  updatedAt: string;
  category: { name: string; slug: string };
  user: { name: string; email: string };
  viewCount: number;
  readingMinutes: number;
}

function formatAdminDate(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: "-", time: "" };
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

type ArticleSort =
  | "updated_desc"
  | "created_desc"
  | "created_asc"
  | "updated_asc"
  | "published_desc"
  | "published_asc"
  | "title_asc"
  | "title_desc"
  | "views_desc"
  | "views_asc";

type ArticleDateField = "createdAt" | "updatedAt" | "publishedAt";

const STATUSES = ["", "DRAFT", "SUBMITTED", "APPROVED", "PUBLISHED", "SCHEDULED", "REJECTED", "HIDDEN"];
const AUDIO_STATUSES = ["", "NONE", "PROCESSING", "READY", "FAILED"];
const SORT_OPTIONS: { value: ArticleSort; label: string }[] = [
  { value: "updated_desc", label: "Recently Updated" },
  { value: "created_desc", label: "Newest" },
  { value: "created_asc", label: "Oldest" },
  { value: "updated_asc", label: "Least Recently Updated" },
  { value: "published_desc", label: "Newest Published" },
  { value: "published_asc", label: "Oldest Published" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "title_desc", label: "Title Z-A" },
  { value: "views_desc", label: "Most Views" },
  { value: "views_asc", label: "Fewest Views" },
];
const DATE_FIELDS: { value: ArticleDateField; label: string }[] = [
  { value: "createdAt", label: "Created Date" },
  { value: "updatedAt", label: "Updated Date" },
  { value: "publishedAt", label: "Published Date" },
];

export default function AdminArticles() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const audioFilter = searchParams.get("audioStatus") || "";
  const titleQuery = searchParams.get("q") || "";
  const sortFilter = (searchParams.get("sort") || "updated_desc") as ArticleSort;
  const dateFieldFilter = (searchParams.get("dateField") || "createdAt") as ArticleDateField;
  const dateFromFilter = searchParams.get("dateFrom") || "";
  const dateToFilter = searchParams.get("dateTo") || "";
  const hasActiveFilters = Boolean(
    statusFilter ||
      audioFilter ||
      titleQuery ||
      dateFromFilter ||
      dateToFilter ||
      sortFilter !== "updated_desc" ||
      dateFieldFilter !== "createdAt"
  );
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState(titleQuery);
  const [page, setPage] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rejectingArticle, setRejectingArticle] = useState<Article | null>(null);
  const [rejectInstructions, setRejectInstructions] = useState("");
  const [rejectSending, setRejectSending] = useState(false);
  const [audioGeneratingId, setAudioGeneratingId] = useState<string | null>(null);
  const [idCopyTarget, setIdCopyTarget] = useState<string | null>(null);
  const [idCopied, setIdCopied] = useState(false);

  const updateFilter = (key: string, value: string) => {
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const buildArticleParams = (pageNumber = page): Record<string, string> => {
    const params: Record<string, string> = { page: String(pageNumber) };
    if (statusFilter) params.status = statusFilter;
    if (audioFilter) params.audioStatus = audioFilter;
    if (titleQuery) params.q = titleQuery;
    if (sortFilter) params.sort = sortFilter;
    if (dateFieldFilter) params.dateField = dateFieldFilter;
    if (dateFromFilter) params.dateFrom = dateFromFilter;
    if (dateToFilter) params.dateTo = dateToFilter;
    return params;
  };

  const clearFilters = () => {
    setPage(1);
    setSearchText("");
    setSearchParams({});
  };

  const openIdCopyWindow = (articleId: string) => {
    setIdCopyTarget(articleId);
    setIdCopied(false);
  };

  const copyArticleId = async () => {
    if (!idCopyTarget) return;
    try {
      await navigator.clipboard.writeText(idCopyTarget);
      setIdCopied(true);
    } catch {
      setIdCopied(false);
    }
  };

  useEffect(() => {
    setSearchText(titleQuery);
  }, [titleQuery]);

  useEffect(() => {
    const normalized = searchText.trim();
    if (normalized === titleQuery) return;

    const timer = window.setTimeout(() => {
      updateFilter("q", normalized);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchText, titleQuery]);

  useEffect(() => {
    setLoading(true);

    api
      .get("/admin/articles", { params: buildArticleParams() })
      .then((res) => {
        setArticles(res.data.articles);
        setTotalArticles(res.data.total || 0);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [
    page,
    statusFilter,
    audioFilter,
    titleQuery,
    sortFilter,
    dateFieldFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  const handleAction = async (
    id: string,
    action: "approve" | "hide" | "unhide" | "delete"
  ) => {
    try {
      if (action === "approve") {
        await api.put(`/admin/articles/${id}/approve`);
      } else if (action === "hide") {
        await api.put(`/admin/articles/${id}/hide`);
      } else if (action === "unhide") {
        await api.put(`/admin/articles/${id}/unhide`);
      } else {
        if (!confirm("Delete this article permanently?")) return;
        await api.delete(`/admin/articles/${id}`);
      }
      setArticles((prev) =>
        action === "delete"
          ? prev.filter((a) => a.id !== id)
          : prev.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status:
                      action === "approve"
                        ? "PUBLISHED"
                        : action === "hide"
                            ? "HIDDEN"
                            : "SUBMITTED",
                    audioStatus: action === "approve" ? "PROCESSING" : a.audioStatus,
                  }
                : a
            )
      );
      if (action === "approve") {
        void pollArticleAudioStatus(id);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to ${action}`);
    }
  };

  const handleGenerateAudio = async (article: Article) => {
    if (article.status !== "PUBLISHED") return;

    try {
      setAudioGeneratingId(article.id);
      const { data } = await api.put(`/admin/articles/${article.id}/audio`);
      const audioStatus = data?.article?.audioStatus || "PROCESSING";
      setArticles((prev) =>
        prev.map((item) =>
          item.id === article.id
            ? {
                ...item,
                audioStatus,
                audioUrl: data?.article?.audioUrl ?? item.audioUrl,
              }
            : item
        )
      );
      void pollArticleAudioStatus(article.id);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to start audio generation");
    } finally {
      setAudioGeneratingId(null);
    }
  };

  const pollArticleAudioStatus = async (articleId: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));

      try {
        const { data } = await api.get("/admin/articles", { params: buildArticleParams() });
        const nextArticles = Array.isArray(data.articles) ? data.articles : [];
        setArticles(nextArticles);
        setTotalArticles(data.total || 0);
        setTotalPages(data.totalPages || 1);

        const updated = nextArticles.find((item: Article) => item.id === articleId);
        if (updated && updated.audioStatus !== "PROCESSING") return;
      } catch (err) {
        console.error("audio status poll failed", err);
        return;
      }
    }
  };

  const openRejectModal = (article: Article) => {
    setRejectingArticle(article);
    setRejectInstructions("");
  };

  const closeRejectModal = () => {
    if (rejectSending) return;
    setRejectingArticle(null);
    setRejectInstructions("");
  };

  const handleRejectSubmit = async () => {
    if (!rejectingArticle) return;
    const instructions = rejectInstructions.trim();
    if (!instructions) {
      alert("Please provide rejection instructions for the author.");
      return;
    }

    if (instructions.length > 3000) {
      alert("Instructions must be 3000 characters or fewer.");
      return;
    }

    try {
      setRejectSending(true);
      await api.put(`/admin/articles/${rejectingArticle.id}/reject`, { instructions });
      setArticles((prev) =>
        prev.map((a) =>
          a.id === rejectingArticle.id
            ? { ...a, status: "REJECTED" }
            : a
        )
      );
      setRejectingArticle(null);
      setRejectInstructions("");
      alert("Article rejected and email sent to the author.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to reject article");
    } finally {
      setRejectSending(false);
    }
  };

  return (
    <>
      <SEOHead title="Manage Articles" noindex />
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
          Manage Articles
        </h1>
        <p className="text-sm text-neutral-500 whitespace-nowrap">
          {totalArticles.toLocaleString()} articles
        </p>
      </div>

      <div className="bg-white border border-black/15 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Search Title or ID
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Keyword from title or article ID"
              className="px-3 py-2 border border-black/25 bg-white text-sm normal-case tracking-normal text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Sort
            <select
              value={sortFilter}
              onChange={(e) => updateFilter("sort", e.target.value)}
              className="px-3 py-2 border border-black/25 bg-white text-sm normal-case tracking-normal text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Status
            <select
              value={statusFilter}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="px-3 py-2 border border-black/25 bg-white text-sm normal-case tracking-normal text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            >
              <option value="">All Statuses</option>
              {STATUSES.filter(Boolean).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Audio
            <select
              value={audioFilter}
              onChange={(e) => updateFilter("audioStatus", e.target.value)}
              className="px-3 py-2 border border-black/25 bg-white text-sm normal-case tracking-normal text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            >
              <option value="">All Audio</option>
              {AUDIO_STATUSES.filter(Boolean).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Date Type
            <select
              value={dateFieldFilter}
              onChange={(e) => updateFilter("dateField", e.target.value)}
              className="px-3 py-2 border border-black/25 bg-white text-sm normal-case tracking-normal text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            >
              {DATE_FIELDS.map((field) => (
                <option key={field.value} value={field.value}>{field.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            From
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="px-3 py-2 border border-black/25 bg-white text-sm normal-case tracking-normal text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            To
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="px-3 py-2 border border-black/25 bg-white text-sm normal-case tracking-normal text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="w-full px-4 py-2 border border-black/25 text-sm font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-black hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-neutral-700 disabled:cursor-not-allowed"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : articles.length === 0 ? (
        <p className="text-neutral-500 text-center py-10">No articles found.</p>
      ) : (
        <>
          <div className="bg-white border border-black/15 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Title</th>
                  <th className="text-left px-4 py-3 font-semibold">Uploaded</th>
                  <th className="text-left px-4 py-3 font-semibold">Author</th>
                  <th className="text-left px-4 py-3 font-semibold">Category</th>
                  <th className="text-left px-4 py-3 font-semibold">Link</th>
                  <th className="text-left px-4 py-3 font-semibold">Views</th>
                  <th className="text-left px-4 py-3 font-semibold">Read</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Audio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {articles.map((article) => (
                  <Fragment key={article.id}>
                    <tr className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openIdCopyWindow(article.id)}
                          title="Click to copy article ID"
                          className="text-left hover:text-[#b5121b] hover:underline"
                        >
                          {article.id.slice(0, 4)}...
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        <span
                          title={article.title}
                          className="cursor-default"
                        >
                          {article.title.length > 10
                            ? article.title.slice(0, 10) + "…"
                            : article.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                        <span className="flex flex-col leading-tight">
                          <span>{formatAdminDate(article.createdAt).date}</span>
                          {formatAdminDate(article.createdAt).time && (
                            <span className="text-xs text-neutral-400">
                              {formatAdminDate(article.createdAt).time}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{article.user.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{article.category.name}</td>
                      <td className="px-4 py-3">
                        {article.originalSourceUrl ? (
                          <a
                            href={article.originalSourceUrl}
                            target="_blank"
                            rel="nofollow noopener noreferrer"
                            className="text-[#b5121b] hover:underline break-all"
                          >
                            Link
                          </a>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          {article.viewCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {article.readingMinutes} min
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={article.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {article.status === "PUBLISHED" &&
                        article.audioStatus !== "PROCESSING" &&
                        article.audioStatus !== "READY" &&
                        article.audioStatus !== "FAILED" ? (
                          <button
                            onClick={() => handleGenerateAudio(article)}
                            disabled={audioGeneratingId === article.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:border-purple-300 hover:bg-purple-100 disabled:opacity-60"
                          >
                            <span aria-hidden="true">♪</span>
                            {audioGeneratingId === article.id ? "Starting" : "Create"}
                          </button>
                        ) : article.status === "PUBLISHED" && article.audioStatus === "FAILED" ? (
                          <button
                            onClick={() => handleGenerateAudio(article)}
                            disabled={audioGeneratingId === article.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:border-red-300 hover:bg-red-100 disabled:opacity-60"
                          >
                            <span aria-hidden="true">↻</span>
                            {audioGeneratingId === article.id ? "Starting" : "Retry"}
                          </button>
                        ) : (
                          <AudioStatusBadge status={article.audioStatus || "NONE"} />
                        )}
                      </td>
                    </tr>
                    <tr className="bg-neutral-50/70">
                      <td colSpan={10} className="px-4 pb-3 pt-0">
                        <div className="flex flex-wrap justify-end gap-1">
                        <Link
                          to={`/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Preview
                        </Link>
                        {isAdmin && (
                          <Link
                            to={`/admin/articles/edit/${article.id}`}
                            className="px-2 py-1 text-xs bg-[#b5121b] text-white hover:bg-[#8f0f16]"
                          >
                            Edit
                          </Link>
                        )}
                        {article.status === "SUBMITTED" && (
                          <>
                            <button
                              onClick={() => handleAction(article.id, "approve")}
                              className="px-2 py-1 text-xs bg-green-700 text-white hover:bg-green-800"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openRejectModal(article)}
                              className="px-2 py-1 text-xs bg-amber-600 text-white hover:bg-amber-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {article.status !== "HIDDEN" ? (
                          <button
                            onClick={() => handleAction(article.id, "hide")}
                            className="px-2 py-1 text-xs bg-neutral-700 text-white hover:bg-neutral-800"
                          >
                            Hide
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(article.id, "unhide")}
                            className="px-2 py-1 text-xs bg-indigo-700 text-white hover:bg-indigo-800"
                          >
                            Unhide
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleAction(article.id, "delete")}
                            className="px-2 py-1 text-xs bg-red-700 text-white hover:bg-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border border-black disabled:opacity-50 text-sm">Prev</button>
              <span className="px-4 py-2 text-sm text-neutral-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 border border-black disabled:opacity-50 text-sm">Next</button>
            </div>
          )}
        </>
      )}

      {idCopyTarget && (
        <div className="fixed inset-0 z-[80] bg-black/35 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-black/15 shadow-xl">
            <div className="px-4 py-3 border-b border-black/10">
              <h2 className="text-sm font-semibold text-neutral-900">Article ID</h2>
            </div>
            <div className="px-4 py-4">
              <input
                readOnly
                value={idCopyTarget}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full border border-black/20 px-3 py-2 font-mono text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]/30"
              />
              {idCopied && (
                <p className="mt-2 text-xs font-semibold text-green-700">Copied to clipboard.</p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-black/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIdCopyTarget(null)}
                className="px-3 py-1.5 text-sm border border-black/20 hover:bg-neutral-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={copyArticleId}
                className="px-3 py-1.5 text-sm bg-[#b5121b] text-white hover:bg-[#8f0f16]"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectingArticle && (
        <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-black/15 shadow-xl">
            <div className="px-5 py-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-neutral-900">Reject Submitted Article</h2>
              <p className="text-sm text-neutral-600 mt-1">
                Add clear instructions for the author. These details will be sent by email.
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-neutral-700 mb-2">
                <span className="font-semibold">Article:</span> {rejectingArticle.title}
              </p>
              <label htmlFor="reject-instructions" className="block text-sm font-semibold text-neutral-800 mb-2">
                Rejection Instructions
              </label>
              <textarea
                id="reject-instructions"
                value={rejectInstructions}
                onChange={(e) => setRejectInstructions(e.target.value)}
                placeholder="Explain what must be corrected before resubmission..."
                className="w-full min-h-[180px] border border-black/20 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]/30"
                maxLength={3000}
                disabled={rejectSending}
              />
              <p className="text-xs text-neutral-500 mt-1">
                {rejectInstructions.length}/3000 characters
              </p>
            </div>
            <div className="px-5 py-4 border-t border-black/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectModal}
                className="px-3 py-1.5 text-sm border border-black/20 hover:bg-neutral-50"
                disabled={rejectSending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                disabled={rejectSending}
              >
                {rejectSending ? "Sending..." : "Reject & Send Email"}
              </button>
            </div>
          </div>
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
    PUBLISHED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    HIDDEN: "bg-neutral-200 text-neutral-800",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.DRAFT}`}>
      {status}
    </span>
  );
}

function AudioStatusBadge({ status }: { status: "NONE" | "PROCESSING" | "READY" | "FAILED" }) {
  const styles: Record<typeof status, string> = {
    NONE: "bg-neutral-100 text-neutral-600",
    PROCESSING: "bg-blue-100 text-blue-700",
    READY: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
  };

  const labels: Record<typeof status, string> = {
    NONE: "None",
    PROCESSING: "Processing",
    READY: "Ready",
    FAILED: "Failed",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.NONE}`}>
      {labels[status] || labels.NONE}
    </span>
  );
}
