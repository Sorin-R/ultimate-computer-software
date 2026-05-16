import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface ReportItem {
  id: string;
  targetType: "ARTICLE" | "COMMENT" | "USER" | "DM";
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  publicUpdate: string | null;
  statusUpdatedAt: string | null;
  createdAt: string;
}

export default function MyReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/me/reports")
      .then((res) => setReports(res.data.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SEOHead title="My Reports" path="/dashboard/reports" />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">My Reports</h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-neutral-500">You have not submitted any reports yet.</p>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="bg-white border border-black/15 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm uppercase tracking-[0.08em] text-neutral-500 font-semibold">
                  {report.targetType} • {report.reason}
                </p>
                <StatusPill status={report.status} />
              </div>
              {report.description && <p className="mt-2 text-sm text-neutral-700">{report.description}</p>}
              {report.publicUpdate && (
                <div className="mt-3 p-3 bg-neutral-50 border border-black/10 text-sm text-neutral-700">
                  Latest update: {report.publicUpdate}
                </div>
              )}
              <p className="mt-3 text-xs text-neutral-500">
                Submitted {new Date(report.createdAt).toLocaleString()}
                {report.statusUpdatedAt ? ` • Updated ${new Date(report.statusUpdatedAt).toLocaleString()}` : ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalizedStatus = status === "SUBMITTED" ? "UNDER_REVIEW" : status;

  const styles: Record<string, string> = {
    UNDER_REVIEW: "bg-amber-100 text-amber-700",
    ACTION_TAKEN: "bg-green-100 text-green-700",
    NO_VIOLATION_FOUND: "bg-neutral-200 text-neutral-700",
    DISMISSED: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
        styles[normalizedStatus] || styles.UNDER_REVIEW
      }`}
    >
      {normalizedStatus.replace(/_/g, " ")}
    </span>
  );
}
