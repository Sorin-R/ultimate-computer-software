import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import FollowButton from "../../components/FollowButton";
import VerifiedBadge from "../../components/VerifiedBadge";
import UserBadgeList from "../../components/UserBadgeList";
import CreatorAvatar from "../../components/CreatorAvatar";
import ArticleListenBadge from "../../components/ArticleListenBadge";
import { cleanExcerptText } from "../../utils/contentText";
import { hasReadyAudio, type ArticleAudioStatus } from "../../utils/articleAudio";
import { getImageUrl } from "../../utils/imageUrl";
import { absoluteSiteUrl } from "../../utils/site";
import { useAuth } from "../../context/AuthContext";
import ReportModal from "../../components/ReportModal";
import { Helmet } from "react-helmet-async";

/**
 * Public author profile page (C2). Renders bio, avatar, follower count,
 * verified badge, pinned article (C9) and a paginated list of the author's
 * published articles. Logged-in viewers see a Follow / Following button and
 * mute action.
 */

interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  publishedAt: string | null;
  createdAt: string;
  category: { name: string; slug: string };
}

interface AuthorProfile {
  id: string;
  username: string | null;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  memberSince: string;
  subscriberCount: number;
  articleCount: number;
  verifiedTier: "verified" | "top" | null;
  isFollowing: boolean;
  isMuted: boolean;
  iAmBlocked: boolean;
  isBlockedByMe: boolean;
  hasBlockedMe: boolean;
  isSelf: boolean;
}

interface ProfileResponse {
  author: AuthorProfile;
  pinnedArticle: ArticleSummary | null;
  articles: ArticleSummary[];
  page: number;
  totalPages: number;
  total: number;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AuthorPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [page, setPage] = useState(1);
  const [muteBusy, setMuteBusy] = useState(false);
  // Local state mirrors of the relationship + counter so optimistic toggles
  // are felt immediately without re-fetching the whole profile.
  const [following, setFollowing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    api
      .get(`/users/${id}/profile`, { params: { page, limit: 12 } })
      .then((res) => {
        const r = res.data as ProfileResponse;
        setData(r);
        setFollowing(r.author.isFollowing);
        setMuted(r.author.isMuted);
        setSubscriberCount(r.author.subscriberCount);
        setIsBlockedByMe(r.author.isBlockedByMe);
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id, page]);

  const toggleMute = async () => {
    if (!id || !following || muteBusy) return;
    setMuteBusy(true);
    const next = !muted;
    setMuted(next);
    try {
      await api.post(`/users/${id}/${next ? "mute" : "unmute"}`);
    } catch {
      setMuted(!next);
      alert("Action failed");
    } finally {
      setMuteBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!id) return;
    const next = !isBlockedByMe;
    setIsBlockedByMe(next);
    try {
      if (next) {
        await api.post(`/users/${id}/block`);
        setFollowing(false);
      } else {
        await api.delete(`/users/${id}/block`);
      }
    } catch (err: any) {
      setIsBlockedByMe(!next);
      alert(err.response?.data?.error || "Action failed");
    }
  };

  if (notFound) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Author Not Found</h1>
        <Link to="/" className="text-[#b5121b] hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
      </div>
    );
  }

  const a = data.author;

  return (
    <>
      <SEOHead
        title={a.name}
        description={a.bio || `Articles by ${a.name} on Ultimate Computer Software.`}
        path={`/author/${a.username ?? a.id}`}
      />
      <Helmet>
        {/* M6: Clean canonical URL — SEOHead already strips ?page=N via cleanCanonical default */}
        {/* M4: Person schema for E-E-A-T signals */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name: a.name,
          url: absoluteSiteUrl(`/author/${a.username ?? a.id}`),
          image: a.avatarUrl || undefined,
          description: a.bio || undefined,
          // sameAs: populated here once socialUrls are stored on the user profile
        })}</script>
        {/* L4: ItemList schema for the author's visible articles */}
        {data.articles.length > 0 && (
          <script type="application/ld+json">{JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: data.articles.slice(0, 10).map((article, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: absoluteSiteUrl(`/${article.slug}`),
              name: article.title,
            })),
          })}</script>
        )}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${a.name} RSS Feed`}
          href={`/rss/author/${encodeURIComponent(a.username ?? a.id)}.xml`}
        />
      </Helmet>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8 pb-6 border-b border-black/15">
          <CreatorAvatar name={a.name} avatarUrl={a.avatarUrl} size={88} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
                {a.name}
              </h1>
              <VerifiedBadge tier={a.verifiedTier} size={20} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-neutral-600">
              <span>
                <strong className="text-neutral-900">
                  {subscriberCount.toLocaleString()}
                </strong>{" "}
                followers
              </span>
              <span>
                <strong className="text-neutral-900">{a.articleCount}</strong> articles
              </span>
              <span>Member since {formatDate(a.memberSince)}</span>
            </div>
            {a.bio && (
              <p className="mt-3 text-neutral-700 whitespace-pre-wrap max-w-prose">
                {a.bio}
              </p>
            )}
            {/* K8: full achievement badge list on author profile. */}
            <UserBadgeList userId={a.id} variant="full" className="mt-4" />
            {a.hasBlockedMe && (
              <p className="mt-3 text-sm text-red-700">
                This user has blocked you. Follow and interaction actions are unavailable.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <FollowButton
              creatorId={a.id}
              initialFollowing={following}
              initialBlocked={a.iAmBlocked || a.hasBlockedMe || isBlockedByMe}
              isSelf={a.isSelf}
              variant="primary"
              onChange={setFollowing}
              onCountChange={(d) => setSubscriberCount((c) => Math.max(0, c + d))}
            />
            {!a.isSelf && (
              <button
                onClick={toggleBlock}
                className="px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] border border-black/20 hover:bg-neutral-100"
              >
                {isBlockedByMe ? "Unblock user" : "Block user"}
              </button>
            )}
            {user && !a.isSelf && (
              <button
                onClick={() => setShowReportModal(true)}
                className="px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] border border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                Report user
              </button>
            )}
            {following && !a.isSelf && (
              <button
                onClick={toggleMute}
                disabled={muteBusy}
                className="px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] border border-black/20 hover:bg-neutral-100"
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            )}
            {!a.isSelf && (
              <Link
                to={`/author/${a.username ?? a.id}/policy-compliance`}
                className="text-xs uppercase tracking-[0.08em] text-[#b5121b] hover:underline"
              >
                Policy compliance
              </Link>
            )}
          </div>
        </header>

        {/* Pinned article (C9) */}
        {data.pinnedArticle && (
          <section className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b5121b] mb-2">
              Pinned by author
            </p>
            <ArticleRow article={data.pinnedArticle} large />
          </section>
        )}

        {/* Article list */}
        {data.articles.length === 0 && !data.pinnedArticle ? (
          <p className="text-center text-neutral-500 py-12">
            No articles published yet.
          </p>
        ) : (
          <section className="space-y-6">
            {data.articles.map((art) => (
              <ArticleRow key={art.id} article={art} />
            ))}
          </section>
        )}

        {data.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-neutral-600 text-sm">
              Page {page} of {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </main>

      {user && !a.isSelf && (
        <ReportModal
          open={showReportModal}
          targetType="USER"
          targetId={a.id}
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => alert("Report submitted. You can track it in My Reports.")}
        />
      )}
    </>
  );
}

function ArticleRow({ article, large = false }: { article: ArticleSummary; large?: boolean }) {
  return (
    <article
      className={`flex gap-4 ${large ? "border border-black/20 p-4 rounded-lg bg-white" : "border-b border-black/10 pb-6"}`}
    >
      {article.imageUrl && (
        <Link
          to={`/${article.slug}`}
          className={`relative shrink-0 block overflow-hidden rounded ${large ? "w-48" : "w-32 sm:w-40"} aspect-video`}
        >
          {hasReadyAudio(article) && <ArticleListenBadge size="sm" />}
          <img
            src={getImageUrl(article.imageUrl) || article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <Link
          to={`/category/${article.category.slug}`}
          className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b5121b]"
        >
          {article.category.name}
        </Link>
        <h2
          className={`mt-1 font-semibold [font-family:Georgia,'Times_New_Roman',serif] ${
            large ? "text-2xl" : "text-lg sm:text-xl"
          }`}
        >
          <Link to={`/${article.slug}`} className="hover:text-[#b5121b]">
            {article.title}
          </Link>
        </h2>
        {cleanExcerptText(article.excerpt) && (
          <p className="mt-2 text-sm text-neutral-700 line-clamp-2">
            {cleanExcerptText(article.excerpt)}
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          {formatDate(article.publishedAt)}
        </p>
      </div>
    </article>
  );
}
