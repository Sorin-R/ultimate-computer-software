import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

/**
 * FollowButton — toggles the current user's subscription to a creator (U1).
 *
 * Behaviours:
 *  - Anonymous user → clicking redirects to /login (subscriptions require an
 *    account, policy 1a)
 *  - Self           → button is hidden
 *  - Blocked        → button is disabled with explanatory tooltip
 *  - Otherwise      → optimistic toggle, with rollback on error
 *
 * Variants:
 *  - "primary"   filled red (used on author profile / hero placement)
 *  - "outline"   small outlined (used inline next to the author name)
 */
interface Props {
  creatorId: string;
  initialFollowing: boolean;
  initialBlocked?: boolean;
  isSelf?: boolean;
  variant?: "primary" | "outline";
  onChange?: (next: boolean) => void;
  onCountChange?: (delta: number) => void; // +1 follow, -1 unfollow
  className?: string;
}

export default function FollowButton({
  creatorId,
  initialFollowing,
  initialBlocked = false,
  isSelf = false,
  variant = "outline",
  onChange,
  onCountChange,
  className = "",
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (isSelf) return null;

  const onClick = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (initialBlocked) return;
    if (busy) return;

    // Optimistic update
    const next = !following;
    setFollowing(next);
    onChange?.(next);
    onCountChange?.(next ? 1 : -1);
    setBusy(true);
    try {
      if (next) {
        await api.post(`/users/${creatorId}/follow`);
      } else {
        await api.delete(`/users/${creatorId}/follow`);
      }
    } catch (err: any) {
      // Roll back on failure
      setFollowing(!next);
      onChange?.(!next);
      onCountChange?.(next ? -1 : 1);
      const msg = err?.response?.data?.error || "Action failed";
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const base = "font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes =
    variant === "primary"
      ? "px-5 py-2 text-sm"
      : "px-3 py-1 text-xs";
  const colors = following
    ? "bg-white text-neutral-700 border border-black/30 hover:bg-neutral-100"
    : variant === "primary"
    ? "bg-[#b5121b] text-white border border-[#b5121b] hover:bg-[#8f0f16]"
    : "bg-black text-white border border-black hover:bg-neutral-800";

  return (
    <button
      onClick={onClick}
      disabled={busy || initialBlocked}
      title={initialBlocked ? "This creator has blocked you" : undefined}
      className={`${base} ${sizes} ${colors} ${className}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
