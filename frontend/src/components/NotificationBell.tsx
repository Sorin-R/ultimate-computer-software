import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

/**
 * NotificationBell — bell icon in the navbar with an unread-count badge and
 * a dropdown listing recent notifications (U2 + C3).
 *
 *  - Polls /api/me/notifications/unread-count every 60s (lightweight call).
 *  - On click: opens the dropdown and fetches the full notification list.
 *  - On open: marks all as read after a short delay so users can still see
 *    which ones were new.
 *  - Hidden entirely when the user is not logged in.
 */

const VISIBLE_POLL_INTERVAL_MS = 60_000;
const HIDDEN_POLL_INTERVAL_MS = 5 * 60_000;
const MARK_READ_DELAY_MS = 2_500;

interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  authorName: string;
  user: { id: string; name: string; avatarUrl: string | null };
}
interface UserSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}
interface Notification {
  id: string;
  type: "NEW_ARTICLE" | "NEW_SUBSCRIBER";
  readAt: string | null;
  createdAt: string;
  article?: ArticleSummary;
  subscriber?: UserSummary;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Poll the unread count while logged in.
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const nextDelay = () =>
      document.visibilityState === "visible"
        ? VISIBLE_POLL_INTERVAL_MS
        : HIDDEN_POLL_INTERVAL_MS;

    const tick = async () => {
      try {
        const res = await api.get("/me/notifications/unread-count");
        if (!cancelled) setUnread(res.data?.unreadCount ?? 0);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, nextDelay());
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      tick();
    };

    tick();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user]);

  // Close dropdown on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openDropdown = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await api.get("/me/notifications");
      setItems(Array.isArray(res.data?.notifications) ? res.data.notifications : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
    // Delay marking-as-read so the unread highlights stay visible briefly.
    setTimeout(async () => {
      try {
        await api.post("/me/notifications/read", {});
        setUnread(0);
      } catch {
        /* ignore */
      }
    }, MARK_READ_DELAY_MS);
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="relative p-1.5 text-neutral-700 hover:text-[#b5121b]"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#b5121b] text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-black/15 shadow-lg z-50 rounded">
          <div className="px-3 py-2 border-b border-black/10 flex items-center justify-between">
            <span className="font-semibold text-sm">Notifications</span>
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="text-[11px] uppercase tracking-[0.08em] text-[#b5121b] hover:underline"
            >
              Dashboard
            </Link>
          </div>

          {loading ? (
            <div className="p-4 flex justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500 text-center">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-black/10">
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? "" : "bg-amber-50/60"}>
                  {n.type === "NEW_ARTICLE" && n.article && (
                    <Link
                      to={`/${n.article.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-2 p-3 hover:bg-neutral-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-neutral-500">
                          <span className="font-semibold text-neutral-800">
                            {n.article.user.name}
                          </span>{" "}
                          published a new article
                        </p>
                        <p className="text-sm font-semibold line-clamp-2 mt-0.5">
                          {n.article.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          {timeAgo(n.createdAt)} ago
                        </p>
                      </div>
                    </Link>
                  )}
                  {n.type === "NEW_SUBSCRIBER" && n.subscriber && (
                    <Link
                      to={`/author/${n.subscriber.id}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-2 p-3 hover:bg-neutral-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-semibold">
                            {n.subscriber.name}
                          </span>{" "}
                          followed you
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          {timeAgo(n.createdAt)} ago
                        </p>
                      </div>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
