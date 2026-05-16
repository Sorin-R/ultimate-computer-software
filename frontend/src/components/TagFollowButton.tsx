import { useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Props {
  tagSlug: string;
  tagName: string;
  initialFollowing?: boolean;
  followCount?: number;
  size?: "sm" | "md";
}

export default function TagFollowButton({
  tagSlug,
  tagName,
  initialFollowing = false,
  followCount: initialCount,
  size = "md",
}: Props) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [count] = useState(initialCount ?? null);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ following: boolean }>(`/tags/${tagSlug}/follow`);
      setFollowing(res.data.following);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update follow");
    } finally {
      setLoading(false);
    }
  };

  const sm = size === "sm";

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 border font-semibold transition-colors disabled:opacity-50
        ${sm ? "px-2 py-0.5 text-xs rounded-full" : "px-3 py-1.5 text-xs uppercase tracking-[0.06em]"}
        ${following
          ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-700 hover:border-neutral-700"
          : "border-black/25 text-neutral-700 hover:bg-neutral-100"
        }`}
      title={following ? `Unfollow #${tagName}` : `Follow #${tagName}`}
    >
      {following ? (
        <>
          <span>✓</span>
          <span>Following #{tagName}</span>
          {count !== null && <span className="opacity-60">({count})</span>}
        </>
      ) : (
        <>
          <span>+ Follow #{tagName}</span>
          {count !== null && <span className="opacity-60">({count})</span>}
        </>
      )}
    </button>
  );
}
