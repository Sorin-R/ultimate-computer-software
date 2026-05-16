import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { useAuth } from "../../context/AuthContext";

interface ArticleRequest {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "CLAIMED" | "FULFILLED" | "CLOSED";
  voteCount: number;
  hasVoted: boolean;
  requester: { id: string; name: string };
  claimedBy?: { id: string; name: string } | null;
  fulfilledArticle?: { id: string; title: string; slug: string } | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-emerald-100 text-emerald-700",
  CLAIMED: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-neutral-100 text-neutral-600",
  CLOSED: "bg-red-100 text-red-700",
};

export default function ArticleRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ArticleRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"OPEN" | "CLAIMED" | "FULFILLED">("OPEN");

  // New request form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Claim / fulfill
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [fulfillId, setFulfillId] = useState<string | null>(null);
  const [fulfillArticleId, setFulfillArticleId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/requests", { params: { status, page } });
      setRequests(res.data.requests);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const handleVote = async (id: string) => {
    if (!user) return;
    try {
      const res = await api.post<{ voted: boolean; voteCount: number }>(`/requests/${id}/vote`);
      setRequests((prev) =>
        prev.map((r) => r.id === id ? { ...r, hasVoted: res.data.voted, voteCount: res.data.voteCount } : r)
      );
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to vote");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 5) {
      setError("Title must be at least 5 characters");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/requests", { title: title.trim(), description: description.trim() || undefined });
      setTitle("");
      setDescription("");
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (id: string) => {
    try {
      await api.post(`/requests/${id}/claim`);
      setClaimingId(null);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to claim");
    }
  };

  const handleFulfill = async (id: string) => {
    try {
      await api.post(`/requests/${id}/fulfill`, { articleId: fulfillArticleId || undefined });
      setFulfillId(null);
      setFulfillArticleId("");
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to fulfill");
    }
  };

  return (
    <>
      <SEOHead
        title="Article Requests — Ultimate Computer Software"
        description="Request topics you'd like our creators to cover. Vote for the ideas you want most."
        path="/requests"
      />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
                Article Wishlist
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Request topics you want covered. Creators can claim and write them.
              </p>
            </div>
            {user && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="px-4 py-2 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800"
              >
                {showForm ? "Cancel" : "+ New Request"}
              </button>
            )}
          </div>

          {/* New request form */}
          {showForm && (
            <div className="mt-4 bg-white border border-black/15 p-5 space-y-3">
              <h3 className="font-semibold text-sm">What topic should we cover?</h3>
              {error && (
                <p className="text-red-700 text-sm bg-red-50 border border-red-200 px-3 py-2">{error}</p>
              )}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 160))}
                placeholder="e.g. How AI agents will change software development"
                className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                placeholder="Why this topic matters, context you'd like covered… (optional)"
                rows={3}
                className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 bg-[#b5121b] text-white text-sm font-semibold hover:bg-[#8f0f16] disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Status tabs */}
        <div className="flex gap-1 mb-6 border-b border-black/10">
          {(["OPEN", "CLAIMED", "FULFILLED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${
                status === s
                  ? "border-[#b5121b] text-[#b5121b]"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-neutral-500 py-10">No {status.toLowerCase()} requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => (
              <li key={req.id} className="bg-white border border-black/15 p-4">
                <div className="flex items-start gap-4">
                  {/* Upvote column */}
                  <div className="flex flex-col items-center shrink-0 w-10">
                    <button
                      onClick={() => handleVote(req.id)}
                      disabled={!user || req.status !== "OPEN"}
                      className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-bold transition-colors
                        ${req.hasVoted
                          ? "bg-[#b5121b] text-white border-[#b5121b]"
                          : "border-black/20 text-neutral-500 hover:border-[#b5121b] hover:text-[#b5121b]"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={user ? (req.hasVoted ? "Remove vote" : "Upvote") : "Log in to vote"}
                    >
                      ▲
                    </button>
                    <span className="text-sm font-bold text-neutral-700 mt-1">{req.voteCount}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}>
                        {req.status}
                      </span>
                      <span className="text-xs text-neutral-400">
                        by {req.requester.name} · {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-neutral-900 text-sm leading-snug">{req.title}</h3>
                    {req.description && (
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{req.description}</p>
                    )}
                    {req.claimedBy && (
                      <p className="text-xs text-blue-700 mt-1">
                        Claimed by <strong>{req.claimedBy.name}</strong>
                      </p>
                    )}
                    {req.fulfilledArticle && (
                      <Link
                        to={`/${req.fulfilledArticle.slug}`}
                        className="text-xs text-[#b5121b] hover:underline mt-1 block"
                      >
                        → Read: {req.fulfilledArticle.title}
                      </Link>
                    )}
                  </div>

                  {/* Creator actions */}
                  {user && req.status === "OPEN" && req.requester.id !== user.id && (
                    <button
                      onClick={() => { setClaimingId(req.id); handleClaim(req.id); }}
                      disabled={claimingId === req.id}
                      className="shrink-0 px-3 py-1.5 text-xs border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold"
                    >
                      {claimingId === req.id ? "Claiming…" : "Claim"}
                    </button>
                  )}
                  {user && req.status === "CLAIMED" && req.claimedBy?.id === user.id && (
                    <button
                      onClick={() => setFulfillId(req.id)}
                      className="shrink-0 px-3 py-1.5 text-xs border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
                    >
                      Mark Fulfilled
                    </button>
                  )}
                </div>

                {/* Fulfill dialog */}
                {fulfillId === req.id && (
                  <div className="mt-3 pt-3 border-t border-black/10">
                    <p className="text-xs text-neutral-600 mb-2">
                      Optionally paste the article ID from your dashboard:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={fulfillArticleId}
                        onChange={(e) => setFulfillArticleId(e.target.value)}
                        placeholder="Article ID (optional)"
                        className="flex-1 border border-black/20 px-2 py-1 text-xs focus:outline-none focus:border-[#b5121b]"
                      />
                      <button
                        onClick={() => handleFulfill(req.id)}
                        className="px-3 py-1.5 text-xs bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setFulfillId(null)}
                        className="px-3 py-1.5 text-xs border border-black/20 text-neutral-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-neutral-500">
              Page {page} of {totalPages} ({total} total)
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
