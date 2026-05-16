import { useState, useEffect, useCallback } from "react";
import { Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Props {
  articleId: string;
  /** If provided the component skips the initial /check call. */
  initialBookmarked?: boolean;
  className?: string;
  /** "icon" = icon only (default), "outline" = icon + label */
  variant?: "icon" | "outline";
}

export default function BookmarkButton({
  articleId,
  initialBookmarked,
  className = "",
  variant = "icon",
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookmarked, setBookmarked] = useState<boolean>(initialBookmarked ?? false);
  const [loading, setLoading] = useState(false);

  // Only fetch state when user is logged in and no initial value provided.
  useEffect(() => {
    if (!user || initialBookmarked !== undefined) return;
    api
      .get(`/bookmarks/check/${articleId}`)
      .then((r) => setBookmarked(r.data.bookmarked))
      .catch(() => {});
  }, [articleId, user, initialBookmarked]);

  const toggle = useCallback(async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setLoading(true);
    const next = !bookmarked;
    setBookmarked(next); // optimistic
    try {
      const r = await api.post("/bookmarks", { articleId });
      setBookmarked(r.data.bookmarked);
    } catch {
      setBookmarked(!next); // revert
    } finally {
      setLoading(false);
    }
  }, [user, bookmarked, articleId, navigate]);

  if (variant === "outline") {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={bookmarked ? "Remove bookmark" : "Save to bookmarks"}
        title={bookmarked ? "Remove bookmark" : "Save to bookmarks"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors ${
          bookmarked
            ? "bg-[#b5121b] text-white border-[#b5121b] hover:bg-[#8f0f16]"
            : "text-neutral-700 border-black/20 hover:border-[#b5121b] hover:text-[#b5121b]"
        } ${className}`}
      >
        <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
        {bookmarked ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={bookmarked ? "Remove bookmark" : "Save to bookmarks"}
      title={bookmarked ? "Remove bookmark" : "Save to bookmarks"}
      className={`p-1.5 rounded transition-colors ${
        bookmarked
          ? "text-[#b5121b]"
          : "text-neutral-400 hover:text-[#b5121b]"
      } ${className}`}
    >
      <Bookmark size={20} fill={bookmarked ? "currentColor" : "none"} />
    </button>
  );
}
