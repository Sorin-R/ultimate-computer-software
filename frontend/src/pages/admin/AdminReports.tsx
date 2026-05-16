import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

type ReportStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ACTION_TAKEN"
  | "NO_VIOLATION_FOUND"
  | "DISMISSED";

interface ReportItem {
  id: string;
  targetType: "ARTICLE" | "COMMENT" | "USER" | "DM";
  targetId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  internalNote: string | null;
  publicUpdate: string | null;
  createdAt: string;
  reporter: { id: string; name: string; email: string };
  targetUser: { id: string; name: string; email: string } | null;
  reviewer: { id: string; name: string } | null;
  moderationTarget: {
    type: "ARTICLE" | "COMMENT" | "USER";
    label: string;
    path: string;
  } | null;
}

const STATUSES: ReportStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_TAKEN",
  "NO_VIOLATION_FOUND",
  "DISMISSED",
];

export default function AdminReports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("UNDER_REVIEW");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusDraftById, setStatusDraftById] = useState<Record<string, ReportStatus>>({});

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/admin/reports", { params });
      const nextReports: ReportItem[] = res.data.reports || [];
      setReports(nextReports);
      setStatusDraftById(
        nextReports.reduce<Record<string, ReportStatus>>((acc, report) => {
          acc[report.id] = report.status;
          return acc;
        }, {})
      );
    } catch {
      setReports([]);
      setStatusDraftById({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const updateStatus = async (reportId: string) => {
    const nextStatus = statusDraftById[reportId];
    if (!nextStatus || !STATUSES.includes(nextStatus)) return;
    setBusyId(reportId);
    try {
      await api.put(`/admin/reports/${reportId}`, {
        status: nextStatus,
      });
      await load();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update report");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <SEOHead title="Report Queue" path="/admin/reports" noindex />
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">Report Queue</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-black/25 bg-white text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-neutral-500">No reports found.</p>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="bg-white border border-black/15 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-500 font-semibold">
                  {report.targetType} • {report.reason}
                </p>
                <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-700">
                  {report.status.replace(/_/g, " ")}
                </span>
              </div>
                <p className="text-sm text-neutral-700 mt-2">
                Reporter:{" "}
                <Link to={`/author/${report.reporter.id}`} className="text-[#b5121b] hover:underline font-semibold">
                  {report.reporter.name}
                </Link>{" "}
                ({report.reporter.email})
              </p>
              {report.targetUser && (
                <p className="text-sm text-neutral-700 mt-1">
                  Target user:{" "}
                  <Link to={`/author/${report.targetUser.id}`} className="text-[#b5121b] hover:underline font-semibold">
                    {report.targetUser.name}
                  </Link>
                </p>
              )}
              {report.moderationTarget && (
                <p className="text-sm text-neutral-700 mt-1">
                  Target content:{" "}
                  <Link
                    to={report.moderationTarget.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#b5121b] hover:underline font-semibold"
                    title="Open moderation target"
                  >
                    {report.moderationTarget.label}
                  </Link>
                </p>
              )}
              {report.description && <p className="text-sm text-neutral-700 mt-2">{report.description}</p>}
              {report.publicUpdate && (
                <p className="text-sm text-emerald-700 mt-2">Public update: {report.publicUpdate}</p>
              )}
              <p className="text-xs text-neutral-500 mt-2">
                Created {new Date(report.createdAt).toLocaleString()}
                {report.reviewer ? ` • Reviewed by ${report.reviewer.name}` : ""}
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <select
                  value={statusDraftById[report.id] || report.status}
                  onChange={(e) =>
                    setStatusDraftById((prev) => ({
                      ...prev,
                      [report.id]: e.target.value as ReportStatus,
                    }))
                  }
                  className="px-3 py-1.5 border border-black/25 bg-white text-xs font-semibold uppercase tracking-[0.08em]"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => updateStatus(report.id)}
                  disabled={busyId === report.id}
                  className="px-3 py-1.5 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busyId === report.id ? "Saving..." : "Save Status"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
