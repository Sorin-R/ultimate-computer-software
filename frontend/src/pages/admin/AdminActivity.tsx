import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

type Role = "ADMIN" | "MODERATOR";

interface ActivityLog {
  id: string;
  actorId: string;
  actorRole: Role;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  details: string | null;
  metadata: {
    method?: string;
    path?: string;
    statusCode?: number;
    durationMs?: number;
  } | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

type ActivitySort =
  | "created_desc"
  | "created_asc"
  | "action_asc"
  | "action_desc"
  | "target_asc"
  | "target_desc"
  | "actor_role_asc"
  | "actor_role_desc"
  | "actor_name_asc"
  | "actor_name_desc";

const SORT_OPTIONS: { value: ActivitySort; label: string }[] = [
  { value: "created_desc", label: "Newest Activity" },
  { value: "created_asc", label: "Oldest Activity" },
  { value: "action_asc", label: "Action A-Z" },
  { value: "action_desc", label: "Action Z-A" },
  { value: "target_asc", label: "Target Type A-Z" },
  { value: "target_desc", label: "Target Type Z-A" },
  { value: "actor_role_asc", label: "Role A-Z" },
  { value: "actor_role_desc", label: "Role Z-A" },
  { value: "actor_name_asc", label: "Actor Name A-Z" },
  { value: "actor_name_desc", label: "Actor Name Z-A" },
];

const TARGET_TYPES = ["", "ARTICLE", "USER", "COMMENT", "REPORT", "MODERATOR", "CATEGORY", "ADSENSE", "AD", "ADMIN"];

const ACTION_HINTS = [
  "ARTICLE_APPROVE",
  "ARTICLE_REJECT",
  "ARTICLE_HIDE",
  "ARTICLE_UNHIDE",
  "ARTICLE_DELETE",
  "USER_ROLE_UPDATE",
  "USER_BAN",
  "USER_REACTIVATE",
  "USER_VERIFY_TOGGLE",
  "COMMENT_HIDE",
  "COMMENT_RESTORE",
  "REPORT_STATUS_UPDATE",
  "CATEGORY_UPDATE",
  "ADSENSE_UPDATE",
  "AD_UPDATE",
];

function formatActivityDate(value: string): { date: string; time: string } {
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

export default function AdminActivity() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [actorRole, setActorRole] = useState<string>("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ActivitySort>("created_desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasActiveFilters = Boolean(
    actorRole ||
      action.trim() ||
      targetType ||
      search ||
      dateFrom ||
      dateTo ||
      sort !== "created_desc"
  );

  const clearFilters = () => {
    setPage(1);
    setActorRole("");
    setAction("");
    setTargetType("");
    setSearchText("");
    setSearch("");
    setSort("created_desc");
    setDateFrom("");
    setDateTo("");
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchText.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { page: String(page), sort };
        if (actorRole) params.actorRole = actorRole;
        if (action.trim()) params.action = action.trim();
        if (targetType) params.targetType = targetType;
        if (search) params.q = search;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;

        const res = await api.get("/admin/activity", { params });
        setLogs(res.data.logs || []);
        setTotalLogs(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } catch (error) {
        console.error(error);
        setLogs([]);
        setTotalLogs(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [page, actorRole, action, targetType, search, sort, dateFrom, dateTo]);

  return (
    <>
      <SEOHead title="Admin Activity" path="/admin/activity" noindex />
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
          Admin Activity
        </h1>
      </div>

      <div className="bg-white border border-black/15 p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Activity Filters</h2>
            <p className="text-xs text-neutral-500">{totalLogs} matching logs</p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 border border-black/20 text-sm hover:bg-neutral-100"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search actor, action, target, details or ID"
            className="px-3 py-2 border border-black/25 text-sm md:col-span-3"
          />

          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as ActivitySort);
            }}
            className="px-3 py-2 border border-black/25 bg-white text-sm md:col-span-2"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={actorRole}
            onChange={(e) => {
              setPage(1);
              setActorRole(e.target.value);
            }}
            className="px-3 py-2 border border-black/25 bg-white text-sm"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MODERATOR">Moderator</option>
          </select>

          <input
            value={action}
            list="activity-action-options"
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
            placeholder="Action"
            className="px-3 py-2 border border-black/25 text-sm md:col-span-2"
          />
          <datalist id="activity-action-options">
            {ACTION_HINTS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>

          <select
            value={targetType}
            onChange={(e) => {
              setPage(1);
              setTargetType(e.target.value);
            }}
            className="px-3 py-2 border border-black/25 bg-white text-sm"
          >
            {TARGET_TYPES.map((item) => (
              <option key={item || "all"} value={item}>
                {item || "All Targets"}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border border-black/25 text-sm">
            <span className="text-neutral-500 whitespace-nowrap">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
              className="min-w-0 flex-1 outline-none"
            />
          </label>

          <label className="flex items-center gap-2 px-3 py-2 border border-black/25 text-sm">
            <span className="text-neutral-500 whitespace-nowrap">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
              className="min-w-0 flex-1 outline-none"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-neutral-500">No activity found.</p>
      ) : (
        <div className="bg-white border border-black/15 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Time</th>
                <th className="text-left px-4 py-3 font-semibold">Actor</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
                <th className="text-left px-4 py-3 font-semibold">Target</th>
                <th className="text-left px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {logs.map((log) => {
                const activityTime = formatActivityDate(log.createdAt);

                return (
                  <tr key={log.id} className="hover:bg-neutral-50 align-top">
                    <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                      <p>{activityTime.date}</p>
                      <p className="text-xs text-neutral-500">{activityTime.time}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{log.actor.name}</p>
                      <p className="text-xs text-neutral-500">{log.actor.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900">{log.action}</p>
                      {log.metadata?.method && (
                        <p className="text-xs text-neutral-500 mt-1">
                          {log.metadata.method} {log.metadata.path || ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      <p>{log.targetType}</p>
                      {log.targetLabel && (
                        <p className="text-xs text-neutral-700 mt-1">{log.targetLabel}</p>
                      )}
                      {log.targetId && (
                        <p className="text-xs text-neutral-500 break-all mt-1">{log.targetId}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 min-w-[320px]">
                      <p>{log.details || "-"}</p>
                      {typeof log.metadata?.durationMs === "number" && (
                        <p className="text-xs text-neutral-500 mt-2">
                          Completed in {log.metadata.durationMs} ms
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
