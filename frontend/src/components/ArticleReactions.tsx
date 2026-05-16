import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

type Emoji = "LIKE" | "LOVE" | "WOW" | "THINK";

const EMOJI_MAP: Record<Emoji, { symbol: string; label: string }> = {
  LIKE:  { symbol: "👍", label: "Like" },
  LOVE:  { symbol: "❤️", label: "Love" },
  WOW:   { symbol: "🤯", label: "Wow" },
  THINK: { symbol: "🤔", label: "Interesting" },
};

const ORDER: Emoji[] = ["LIKE", "LOVE", "WOW", "THINK"];

interface Totals { LIKE: number; LOVE: number; WOW: number; THINK: number }

interface Props {
  articleSlug: string;
}

export default function ArticleReactions({ articleSlug }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [totals, setTotals] = useState<Totals>({ LIKE: 0, LOVE: 0, WOW: 0, THINK: 0 });
  const [myReaction, setMyReaction] = useState<Emoji | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get(`/articles/${articleSlug}/reactions`)
      .then((r) => {
        setTotals(r.data.totals);
        setMyReaction(r.data.myReaction);
      })
      .catch(() => {});
  }, [articleSlug]);

  const react = async (emoji: Emoji) => {
    if (!user) { navigate("/login"); return; }
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const prev = myReaction;
    const removing = myReaction === emoji;

    setTotals((t) => {
      const next = { ...t };
      if (prev) next[prev] = Math.max(0, next[prev] - 1);
      if (!removing) next[emoji] += 1;
      return next;
    });
    setMyReaction(removing ? null : emoji);

    try {
      const r = await api.post(`/articles/${articleSlug}/reactions`, {
        emoji: removing ? null : emoji,
      });
      setMyReaction(r.data.myReaction);
    } catch {
      // Revert on error
      setTotals((t) => {
        const next = { ...t };
        if (prev) next[prev] += 1;
        if (!removing) next[emoji] = Math.max(0, next[emoji] - 1);
        return next;
      });
      setMyReaction(prev);
    } finally {
      setLoading(false);
    }
  };

  const total = ORDER.reduce((s, e) => s + totals[e], 0);

  return (
    <div className="mt-8 pt-6 border-t border-black/10">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-[0.14em] mb-3">
        Reactions {total > 0 && <span className="font-normal text-neutral-400 ml-1">· {total.toLocaleString()}</span>}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {ORDER.map((emoji) => {
          const { symbol, label } = EMOJI_MAP[emoji];
          const active = myReaction === emoji;
          const count = totals[emoji];
          return (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              disabled={loading}
              title={label}
              aria-label={`${label}: ${count}`}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-all select-none ${
                active
                  ? "bg-[#b5121b]/10 border-[#b5121b]/40 text-[#b5121b] font-semibold scale-105"
                  : "bg-white border-black/15 text-neutral-700 hover:border-[#b5121b]/40 hover:bg-[#b5121b]/5"
              }`}
            >
              <span className="text-base leading-none">{symbol}</span>
              {count > 0 && (
                <span className="tabular-nums text-xs">{count.toLocaleString()}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
