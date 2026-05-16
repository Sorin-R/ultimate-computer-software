import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import CreatorAvatar from "../../components/CreatorAvatar";
import VerifiedBadge from "../../components/VerifiedBadge";
import ArticleListenBadge from "../../components/ArticleListenBadge";
import { hasReadyAudio, type ArticleAudioStatus } from "../../utils/articleAudio";
import { getImageUrl } from "../../utils/imageUrl";

/**
 * Dashboard → My Subscriptions (U5).
 *
 * Lists every creator the current user follows, plus their latest article and
 * an Unfollow / Mute action. The "muted" subscriptions are visually dimmed
 * but kept in the list so the user can find them and unmute.
 */

interface Item {
  creator: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    subscriberCount: number;
    verifiedTier: "verified" | "top" | null;
  };
  mutedAt: string | null;
  since: string;
  latestArticle: {
    id: string;
    title: string;
    slug: string;
    publishedAt: string | null;
    imageUrl: string | null;
    audioUrl?: string | null;
    audioStatus?: ArticleAudioStatus | string | null;
  } | null;
}

export default function MySubscriptions() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get("/me/subscriptions")
      .then((res) => setItems(res.data?.subscriptions ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const unfollow = async (creatorId: string) => {
    if (!confirm("Stop following this creator?")) return;
    setBusy(creatorId);
    try {
      await api.delete(`/users/${creatorId}/follow`);
      setItems((prev) => prev.filter((i) => i.creator.id !== creatorId));
    } catch {
      alert("Action failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleMute = async (creatorId: string, currentlyMuted: boolean) => {
    setBusy(creatorId);
    try {
      await api.post(`/users/${creatorId}/${currentlyMuted ? "unmute" : "mute"}`);
      setItems((prev) =>
        prev.map((i) =>
          i.creator.id === creatorId
            ? { ...i, mutedAt: currentlyMuted ? null : new Date().toISOString() }
            : i
        )
      );
    } catch {
      alert("Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SEOHead title="My Subscriptions" />
      <h1 className="text-3xl font-bold mb-6 [font-family:Georgia,'Times_New_Roman',serif]">
        My Subscriptions
      </h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-neutral-500 py-10 text-center">
          You aren't following anyone yet. Discover creators on{" "}
          <Link to="/" className="text-[#b5121b] hover:underline font-semibold">
            the homepage
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => {
            const muted = !!i.mutedAt;
            return (
              <li
                key={i.creator.id}
                className={`bg-white border border-black/15 p-4 ${
                  muted ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-3 sm:w-64 shrink-0">
                    <CreatorAvatar
                      name={i.creator.name}
                      avatarUrl={i.creator.avatarUrl}
                      size={48}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/author/${i.creator.id}`}
                          className="font-semibold hover:text-[#b5121b] truncate"
                        >
                          {i.creator.name}
                        </Link>
                        <VerifiedBadge tier={i.creator.verifiedTier} size={12} />
                      </div>
                      <p className="text-xs text-neutral-500">
                        {i.creator.subscriberCount.toLocaleString()} followers
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {i.latestArticle ? (
                      <Link
                        to={`/${i.latestArticle.slug}`}
                        className="flex gap-3 group"
                      >
                        {i.latestArticle.imageUrl && (
                          <div className="relative w-24 aspect-video overflow-hidden rounded shrink-0">
                            {hasReadyAudio(i.latestArticle) && (
                              <ArticleListenBadge size="sm" className="left-1 top-1" />
                            )}
                            <img
                              src={
                                getImageUrl(i.latestArticle.imageUrl) ||
                                i.latestArticle.imageUrl
                              }
                              alt={i.latestArticle.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] text-neutral-500 uppercase tracking-[0.08em]">
                            Latest
                          </p>
                          <p className="text-sm font-semibold line-clamp-2 group-hover:text-[#b5121b]">
                            {i.latestArticle.title}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <p className="text-xs text-neutral-400 italic">No articles yet</p>
                    )}
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                    <button
                      disabled={busy === i.creator.id}
                      onClick={() => toggleMute(i.creator.id, muted)}
                      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] border border-black/20 hover:bg-neutral-100 disabled:opacity-50"
                    >
                      {muted ? "Unmute" : "Mute"}
                    </button>
                    <button
                      disabled={busy === i.creator.id}
                      onClick={() => unfollow(i.creator.id)}
                      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] border border-red-700 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Unfollow
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
