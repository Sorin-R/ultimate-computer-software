import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

/**
 * AdminComments — moderator queue for reported comments.
 *
 * Lists all reports filtered by status (PENDING by default). Each row shows the
 * full reported comment, who authored it, who reported it, the reason, and how
 * many distinct reports exist against the same comment. Moderators can:
 *  - Hide the comment (sets status=HIDDEN, closes all pending reports against it)
 *  - Restore a hidden comment (sets status=VISIBLE)
 *  - Delete the comment outright
 *  - Dismiss a single report without touching the comment
 */

type ReportStatus = "PENDING" | "REVIEWED" | "DISMISSED";
type CommentStatus = "VISIBLE" | "HIDDEN" | "DELETED";

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reporter: { id: string; name: string; email: string };
  reviewer: { id: string; name: string } | null;
  comment: {
    id: string;
    content: string;
    status: CommentStatus;
    createdAt: string;
    user: { id: string; name: string; email: string };
    article: { id: string; title: string; slug: string };
    _count: { reports: number; likes: number };
  };
}

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  HATE_SPEECH: "Hate speech",
  MISINFORMATION: "Misinformation",
  OFF_TOPIC: "Off-topic",
  OTHER: "Other",
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "DISMISSED", label: "Dismissed" },
];

export default function AdminComments() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState<string>("PENDING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/comments/reports", {
        params: { status, page },
      });
      setReports(res.data.reports);
      setTotalPages(res.data.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  const action = async (
    type: "hide" | "restore" | "delete" | "dismiss",
    row: ReportRow
  ) => {
    const id = row.comment.id;
    const reportId = row.id;
    setBusyId(reportId);
    try {
      if (type === "hide") {
        await api.put(`/admin/comments/${id}/hide`);
      } else if (type === "restore") {
        await api.put(`/admin/comments/${id}/restore`);
      } else if (type === "delete") {
        if (!confirm("Permanently delete this comment? Replies will be preserved.")) {
          setBusyId(null);
          return;
        }
        await api.delete(`/admin/comments/${id}`);
      } else if (type === "dismiss") {
        await api.put(`/admin/comments/reports/${reportId}/dismiss`);
      }
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || `Failed to ${type}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <SEOHead title="Moderate Comments" noindex />
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
          Moderate Comments
        </h1>
        <div className="flex gap-1 bg-neutral-100 rounded-full p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={`px-3 py-1 text-sm rounded-full ${
                status === f.value
                  ? "bg-white text-neutral-900 shadow-sm font-semibold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-neutral-500 text-center py-10">
          No {status.toLowerCase()} reports. ✨
        </p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const removed = r.comment.status !== "VISIBLE";
            return (
              <li
                key={r.id}
                className="bg-white border border-black/15 rounded-lg p-4"
              >
                <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold uppercase">
                    {REASON_LABELS[r.reason] || r.reason}
                  </span>
                  <StatusPill status={r.comment.status} />
                  <span>•</span>
                  <span>
                    {r.comment._count.reports} report{r.comment._count.reports === 1 ? "" : "s"}
                  </span>
                  <span>•</span>
                  <span>{r.comment._count.likes} likes</span>
                  <span className="ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-neutral-500 mb-1">
                    On article{" "}
                    <Link
                      to={`/${r.comment.article.slug}#comments`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#b5121b] hover:underline font-medium"
                    >
                      {r.comment.article.title}
                    </Link>{" "}
                    by{" "}
                    <span className="font-semibold text-neutral-700">
                      {r.comment.user.name}
                    </span>{" "}
                    <span className="text-neutral-400">({r.comment.user.email})</span>
                  </p>
                  <blockquote
                    className={`mt-2 border-l-4 border-neutral-300 pl-4 py-2 whitespace-pre-wrap break-words ${
                      removed ? "italic text-neutral-400" : "text-neutral-800"
                    }`}
                  >
                    {r.comment.content || (removed ? "[content removed]" : "")}
                  </blockquote>
                </div>

                <div className="text-xs text-neutral-500 mb-3">
                  Reported by{" "}
                  <span className="font-semibold text-neutral-700">{r.reporter.name}</span>{" "}
                  <span className="text-neutral-400">({r.reporter.email})</span>
                  {r.details && (
                    <p className="mt-1 italic text-neutral-600">"{r.details}"</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {r.comment.status === "VISIBLE" ? (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => action("hide", r)}
                      className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                    >
                      Hide comment
                    </button>
                  ) : r.comment.status === "HIDDEN" ? (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => action("restore", r)}
                      className="px-3 py-1.5 text-sm bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  ) : null}
                  <button
                    disabled={busyId === r.id}
                    onClick={() => action("delete", r)}
                    className="px-3 py-1.5 text-sm bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
                  >
                    Delete comment
                  </button>
                  {r.status === "PENDING" && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => action("dismiss", r)}
                      className="px-3 py-1.5 text-sm border border-black/20 rounded hover:bg-neutral-100 disabled:opacity-50"
                    >
                      Dismiss report
                    </button>
                  )}
                  {r.reviewer && (
                    <span className="ml-auto self-center text-xs text-neutral-400">
                      Reviewed by {r.reviewer.name}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-black disabled:opacity-50 text-sm"
          >
            Prev
          </button>
          <span className="px-4 py-2 text-sm text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-black disabled:opacity-50 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

function StatusPill({ status }: { status: CommentStatus }) {
  const styles: Record<CommentStatus, string> = {
    VISIBLE: "bg-green-100 text-green-800",
    HIDDEN: "bg-neutral-200 text-neutral-700",
    DELETED: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}
