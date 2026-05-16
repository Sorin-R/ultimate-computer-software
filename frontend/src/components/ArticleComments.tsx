import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import UserBadgeList from "./UserBadgeList";

/**
 * ArticleComments — full comment system rendered under an article body.
 *
 * Features:
 *  - Threaded discussion (one-level replies; deeper replies are flattened
 *    onto the same parent thread by the backend).
 *  - Sort: newest / oldest / top (most liked).
 *  - Pagination of top-level comments (replies are loaded with their parent).
 *  - Author actions: edit, soft-delete.
 *  - All authenticated users: like (toggle), reply, report.
 *  - Optimistic UI for likes, and inline error surfacing for posts.
 *  - URL auto-linking with rel="ugc nofollow noopener" for SEO/safety.
 *  - Schema.org/Comment JSON-LD emitted into the page so search engines can
 *    surface comment snippets in rich results.
 *  - Live "X people are discussing this" social-proof header.
 *
 * Props:
 *  - articleSlug: slug of the article (used for the API endpoints)
 *  - articleId:   id of the article (only needed for JSON-LD)
 *  - articleTitle, articleUrl: used for JSON-LD
 *  - articleAuthorId: optional; comments by this user get an "Author" badge
 */

type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "HATE_SPEECH"
  | "MISINFORMATION"
  | "OFF_TOPIC"
  | "OTHER";

type ReactionEmoji = "LIKE" | "LOVE" | "WOW" | "THINK" | "HUNDRED" | "QUESTION";

const REACTION_EMOJIS: { emoji: ReactionEmoji; label: string; icon: string }[] = [
  { emoji: "LIKE", label: "Like", icon: "👍" },
  { emoji: "LOVE", label: "Love", icon: "❤️" },
  { emoji: "WOW", label: "Wow", icon: "🤯" },
  { emoji: "THINK", label: "Think", icon: "🤔" },
  { emoji: "HUNDRED", label: "100", icon: "💯" },
  { emoji: "QUESTION", label: "Question", icon: "❓" },
];

interface CommentAuthor {
  id: string | null;
  name: string;
}
interface CommentReactions {
  counts: Partial<Record<ReactionEmoji, number>>;
  myReaction: ReactionEmoji | null;
}

interface CommentNode {
  id: string;
  parentId: string | null;
  content: string;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  createdAt: string;
  editedAt: string | null;
  author: CommentAuthor;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  reportedByMe: boolean;
  isSubscriberOfAuthor: boolean;
  canEdit: boolean;
  canDelete: boolean;
  reactions?: CommentReactions;
}
interface TopLevelComment extends CommentNode {
  replies: CommentNode[];
}

interface ListResponse {
  comments: TopLevelComment[];
  page: number;
  totalPages: number;
  totalTopLevel: number;
  totalVisible: number;
  sort: "newest" | "oldest" | "top";
}

interface Props {
  articleSlug: string;
  articleId: string;
  articleTitle: string;
  articleUrl: string;
  articleAuthorId?: string;
  /** Render without the standalone page section wrapper. */
  embedded?: boolean;
}

const SORTS: { key: "newest" | "oldest" | "top"; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "top", label: "Top" },
  { key: "oldest", label: "Oldest" },
];

const REPORT_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "HATE_SPEECH", label: "Hate speech" },
  { value: "MISINFORMATION", label: "Misinformation" },
  { value: "OFF_TOPIC", label: "Off-topic" },
  { value: "OTHER", label: "Other" },
];

const MAX_LENGTH = 2000;

// ---------- helpers ----------

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Render a comment body: escape HTML, then auto-link http/https URLs with
 *  rel="ugc nofollow noopener" — UGC links must not pass PageRank. */
function renderBody(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const urlRe = /(https?:\/\/[^\s<>"']+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = urlRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const url = match[0];
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="ugc nofollow noopener noreferrer"
        className="text-[#b5121b] hover:underline break-all"
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return parts;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ---------- main component ----------

export default function ArticleComments({
  articleSlug,
  articleId,
  articleTitle,
  articleUrl,
  articleAuthorId,
  embedded = false,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest" | "top">("newest");
  const [error, setError] = useState<string | null>(null);

  // top-level composer
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // reply / edit / report state keyed by comment id
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);

  // K7: Comment reactions — local map of commentId → { counts, myReaction }
  const [reactions, setReactions] = useState<Record<string, CommentReactions>>({});

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse>(
        `/articles/${articleSlug}/comments`,
        { params: { sort, page } }
      );
      setData(res.data);

      // K7: Pre-load reactions for all visible comments
      const allIds: string[] = [];
      for (const c of res.data.comments) {
        allIds.push(c.id);
        for (const r of c.replies) allIds.push(r.id);
      }
      const reactionResults = await Promise.allSettled(
        allIds.map((id) => api.get<{ counts: Record<string, number>; myReaction: string | null }>(`/comments/${id}/reactions`))
      );
      const map: Record<string, CommentReactions> = {};
      allIds.forEach((id, idx) => {
        const r = reactionResults[idx];
        if (r.status === "fulfilled") {
          map[id] = { counts: r.value.data.counts as any, myReaction: r.value.data.myReaction as ReactionEmoji | null };
        }
      });
      setReactions(map);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [articleSlug, sort, page]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // ---------- mutations ----------

  const postTopLevel = async () => {
    if (!user) return;
    const content = draft.trim();
    if (content.length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/articles/${articleSlug}/comments`, { content });
      setDraft("");
      // jump back to first page so the new comment is visible if sorting newest.
      if (page !== 1) setPage(1);
      else await loadComments();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const postReply = async (parentId: string) => {
    if (!user) return;
    const content = replyDraft.trim();
    if (content.length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/articles/${articleSlug}/comments`, { content, parentId });
      setReplyDraft("");
      setReplyingTo(null);
      await loadComments();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async (id: string) => {
    const content = editDraft.trim();
    if (content.length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.put(`/comments/${id}`, { content });
      setEditingId(null);
      setEditDraft("");
      await loadComments();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to save edit");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteOwn = async (id: string) => {
    if (!confirm("Delete your comment? This cannot be undone.")) return;
    try {
      await api.delete(`/comments/${id}`);
      await loadComments();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to delete");
    }
  };

  // Optimistic like — we update local state immediately and roll back on error.
  const toggleLike = async (id: string) => {
    if (!user || !data) return;
    const updateNode = (n: CommentNode): CommentNode =>
      n.id === id
        ? { ...n, liked: !n.liked, likeCount: n.likeCount + (n.liked ? -1 : 1) }
        : n;
    setData({
      ...data,
      comments: data.comments.map((c) => ({
        ...updateNode(c),
        replies: c.replies.map(updateNode),
      })),
    });
    try {
      const res = await api.post(`/comments/${id}/like`);
      // Reconcile the authoritative count from server.
      const fix = (n: CommentNode): CommentNode =>
        n.id === id
          ? { ...n, liked: res.data.liked, likeCount: res.data.likeCount }
          : n;
      setData((d) =>
        d
          ? {
              ...d,
              comments: d.comments.map((c) => ({
                ...fix(c),
                replies: c.replies.map(fix),
              })),
            }
          : d
      );
    } catch (e: any) {
      // rollback by reloading
      await loadComments();
      setError(e.response?.data?.error || "Failed to toggle like");
    }
  };

  const submitReport = async (id: string, reason: ReportReason, details: string) => {
    try {
      await api.post(`/comments/${id}/report`, { reason, details });
      setReportingId(null);
      await loadComments();
      alert("Thanks — our moderators will review this comment.");
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to submit report");
    }
  };

  // K7: Toggle emoji reaction on a comment (optimistic update).
  const reactToComment = async (commentId: string, emoji: ReactionEmoji) => {
    if (!user) return;
    try {
      const res = await api.post<{ counts: Record<string, number>; myReaction: string | null }>(
        `/comments/${commentId}/react`,
        { emoji }
      );
      setReactions((prev) => ({
        ...prev,
        [commentId]: { counts: res.data.counts as any, myReaction: res.data.myReaction as ReactionEmoji | null },
      }));
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to react");
    }
  };

  // ---------- JSON-LD for SEO ----------
  // Emit Schema.org Comment markup so Google can surface comment snippets in
  // rich results and treat the article as a discussion-bearing page.
  const jsonLd = useMemo(() => {
    if (!data) return null;
    const flat: CommentNode[] = [];
    for (const c of data.comments) {
      if (c.status === "VISIBLE") flat.push(c);
      for (const r of c.replies) if (r.status === "VISIBLE") flat.push(r);
    }
    if (!flat.length) return null;
    return {
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      "@id": `${articleUrl}#comments`,
      headline: articleTitle,
      url: articleUrl,
      mainEntityOfPage: articleUrl,
      identifier: articleId,
      commentCount: data.totalVisible,
      comment: flat.slice(0, 20).map((c) => ({
        "@type": "Comment",
        text: c.content,
        dateCreated: c.createdAt,
        author: { "@type": "Person", name: c.author.name },
      })),
    };
  }, [data, articleId, articleTitle, articleUrl]);

  // ---------- render ----------

  return (
    <section
      id="comments"
      aria-label="Reader comments"
      className={embedded ? "" : "mt-12 border-t border-black/15 pt-10"}
    >
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <header className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 [font-family:Georgia,'Times_New_Roman',serif]">
            Discussion
            {data && (
              <span className="ml-2 text-base font-medium text-neutral-500">
                ({data.totalVisible})
              </span>
            )}
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Share your thoughts. Be respectful — comments are public.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setSort(s.key);
                setPage(1);
              }}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                sort === s.key
                  ? "bg-white text-neutral-900 shadow-sm font-semibold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {/* ---------- composer ---------- */}
      {user ? (
        <div className="mb-8">
          <div className="flex gap-3">
            <Avatar name={user.name} />
            <div className="flex-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
                placeholder="Add to the conversation…"
                className="w-full border border-black/20 rounded-lg p-3 text-sm focus:border-[#b5121b] focus:outline-none resize-y min-h-[88px]"
                rows={3}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-400">
                  {draft.length}/{MAX_LENGTH}
                </span>
                <button
                  onClick={postTopLevel}
                  disabled={submitting || draft.trim().length < 2}
                  className="px-4 py-2 bg-[#b5121b] text-white text-sm font-semibold rounded hover:bg-[#8f0f16] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Posting…" : "Post comment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 bg-neutral-50 border border-black/10 rounded-lg p-4 text-sm text-neutral-700">
          <Link to="/login" className="text-[#b5121b] font-semibold hover:underline">
            Log in
          </Link>{" "}
          or{" "}
          <Link to="/register" className="text-[#b5121b] font-semibold hover:underline">
            create an account
          </Link>{" "}
          to join the discussion.
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* ---------- list ---------- */}
      {loading ? (
        <div className="py-10 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : !data || data.comments.length === 0 ? (
        <p className="py-8 text-center text-neutral-500 text-sm">
          No comments yet. Be the first to share your thoughts.
        </p>
      ) : (
        <ul className="space-y-6">
          {data.comments.map((c) => (
            <li key={c.id}>
              <CommentItem
                node={c}
                isAuthor={!!articleAuthorId && c.author.id === articleAuthorId}
                onLike={toggleLike}
                onDelete={deleteOwn}
                onStartReply={() => {
                  setReplyingTo(c.id);
                  setReplyDraft("");
                }}
                onStartEdit={() => {
                  setEditingId(c.id);
                  setEditDraft(c.content);
                }}
                onStartReport={() => setReportingId(c.id)}
                onReact={reactToComment}
                reactions={reactions[c.id]}
                isLoggedIn={!!user}
              />

              {/* reply composer */}
              {replyingTo === c.id && user && (
                <div className="mt-3 ml-12">
                  <ReplyComposer
                    value={replyDraft}
                    onChange={setReplyDraft}
                    onCancel={() => setReplyingTo(null)}
                    onSubmit={() => postReply(c.id)}
                    submitting={submitting}
                  />
                </div>
              )}

              {/* edit composer */}
              {editingId === c.id && (
                <div className="mt-3 ml-12">
                  <EditComposer
                    value={editDraft}
                    onChange={setEditDraft}
                    onCancel={() => setEditingId(null)}
                    onSubmit={() => saveEdit(c.id)}
                    submitting={submitting}
                  />
                </div>
              )}

              {/* report dialog */}
              {reportingId === c.id && (
                <ReportDialog
                  onCancel={() => setReportingId(null)}
                  onSubmit={(reason, details) => submitReport(c.id, reason, details)}
                />
              )}

              {/* replies */}
              {c.replies.length > 0 && (
                <ul className="mt-4 ml-12 space-y-4 border-l-2 border-neutral-200 pl-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem
                        node={r}
                        isAuthor={!!articleAuthorId && r.author.id === articleAuthorId}
                        onLike={toggleLike}
                        onDelete={deleteOwn}
                        onStartReply={() => {
                          setReplyingTo(c.id);
                          setReplyDraft(`@${r.author.name} `);
                        }}
                        onStartEdit={() => {
                          setEditingId(r.id);
                          setEditDraft(r.content);
                        }}
                        onStartReport={() => setReportingId(r.id)}
                        onReact={reactToComment}
                        reactions={reactions[r.id]}
                        isLoggedIn={!!user}
                        compact
                      />
                      {editingId === r.id && (
                        <div className="mt-3">
                          <EditComposer
                            value={editDraft}
                            onChange={setEditDraft}
                            onCancel={() => setEditingId(null)}
                            onSubmit={() => saveEdit(r.id)}
                            submitting={submitting}
                          />
                        </div>
                      )}
                      {reportingId === r.id && (
                        <ReportDialog
                          onCancel={() => setReportingId(null)}
                          onSubmit={(reason, details) =>
                            submitReport(r.id, reason, details)
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-black/20 text-sm rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-neutral-500">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1.5 border border-black/20 text-sm rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- subcomponents ----------

function Avatar({ name }: { name: string }) {
  // Stable per-name hue so each user gets a consistent colour without storing
  // anything server-side.
  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }, [name]);
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ backgroundColor: `hsl(${hue} 55% 45%)` }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

function CommentItem({
  node,
  isAuthor,
  onLike,
  onDelete,
  onStartReply,
  onStartEdit,
  onStartReport,
  onReact,
  reactions,
  isLoggedIn,
  compact,
}: {
  node: CommentNode;
  isAuthor: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onStartReply: () => void;
  onStartEdit: () => void;
  onStartReport: () => void;
  onReact: (commentId: string, emoji: ReactionEmoji) => void;
  reactions?: CommentReactions;
  isLoggedIn: boolean;
  compact?: boolean;
}) {
  const isRemoved = node.status !== "VISIBLE";
  return (
    <article
      className={`flex gap-3 ${compact ? "text-sm" : ""}`}
      itemScope
      itemType="https://schema.org/Comment"
    >
      <Avatar name={node.author.name} />
      <div className="flex-1 min-w-0">
        <header className="flex items-center gap-2 flex-wrap text-sm">
          <span
            className="font-semibold text-neutral-900"
            itemProp="author"
            itemScope
            itemType="https://schema.org/Person"
          >
            <span itemProp="name">{node.author.name}</span>
          </span>
          {/* K8: top achievement badges next to the commenter's name. */}
          <UserBadgeList userId={node.author.id ?? undefined} limit={2} />
          {isAuthor && (
            <span className="text-[10px] uppercase tracking-wide bg-[#b5121b]/10 text-[#8f0f16] px-2 py-0.5 rounded-full font-semibold">
              Author
            </span>
          )}
          {!isAuthor && node.isSubscriberOfAuthor && (
            <span
              className="text-[10px] uppercase tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold"
              title="This commenter follows the author"
            >
              Subscriber
            </span>
          )}
          <time
            dateTime={node.createdAt}
            itemProp="dateCreated"
            className="text-neutral-400 text-xs"
            title={new Date(node.createdAt).toLocaleString()}
          >
            {timeAgo(node.createdAt)}
          </time>
          {node.editedAt && (
            <span className="text-neutral-400 text-xs italic">(edited)</span>
          )}
        </header>

        <div
          className={`mt-1 text-neutral-800 whitespace-pre-wrap break-words ${
            isRemoved ? "italic text-neutral-400" : ""
          }`}
          itemProp="text"
        >
          {isRemoved ? node.content : renderBody(node.content)}
        </div>

        {!isRemoved && (
          <footer className="mt-2 space-y-1.5">
            {/* K7: Emoji reaction bar */}
            <div className="flex items-center gap-1 flex-wrap">
              {REACTION_EMOJIS.map(({ emoji, label, icon }) => {
                const count = (reactions?.counts?.[emoji] ?? 0);
                const active = reactions?.myReaction === emoji;
                return (
                  <button
                    key={emoji}
                    onClick={() => onReact(node.id, emoji)}
                    disabled={!isLoggedIn}
                    title={isLoggedIn ? label : `Log in to react`}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors border
                      ${active
                        ? "bg-[#b5121b]/10 border-[#b5121b]/30 text-[#8f0f16] font-semibold"
                        : "border-transparent hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
                      } disabled:cursor-not-allowed`}
                  >
                    <span>{icon}</span>
                    {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => onLike(node.id)}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1 ${
                node.liked
                  ? "text-[#b5121b] font-semibold"
                  : "text-neutral-500 hover:text-neutral-900"
              } disabled:cursor-not-allowed`}
              title={isLoggedIn ? "Like" : "Log in to like"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={node.liked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {node.likeCount > 0 ? node.likeCount : ""} Like
            </button>
            {!compact && (
              <button
                onClick={onStartReply}
                disabled={!isLoggedIn}
                className="text-neutral-500 hover:text-neutral-900 disabled:cursor-not-allowed"
                title={isLoggedIn ? "Reply" : "Log in to reply"}
              >
                Reply
              </button>
            )}
            {node.canEdit && (
              <button
                onClick={onStartEdit}
                className="text-neutral-500 hover:text-neutral-900"
              >
                Edit
              </button>
            )}
            {node.canDelete && (
              <button
                onClick={() => onDelete(node.id)}
                className="text-neutral-500 hover:text-red-700"
              >
                Delete
              </button>
            )}
            {isLoggedIn && !node.canEdit && !node.canDelete && (
              <button
                onClick={onStartReport}
                disabled={node.reportedByMe}
                className="text-neutral-400 hover:text-neutral-700 disabled:cursor-not-allowed disabled:line-through"
                title={node.reportedByMe ? "Already reported" : "Report this comment"}
              >
                {node.reportedByMe ? "Reported" : "Report"}
              </button>
            )}
            <a
              href={`#comment-${node.id}`}
              className="ml-auto text-neutral-400 hover:text-neutral-700"
              title="Permalink"
            >
              #
            </a>
            </div>
          </footer>
        )}
      </div>
    </article>
  );
}

function ReplyComposer({
  value,
  onChange,
  onCancel,
  onSubmit,
  submitting,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_LENGTH))}
        placeholder="Write a reply…"
        autoFocus
        className="w-full border border-black/20 rounded-lg p-3 text-sm focus:border-[#b5121b] focus:outline-none resize-y min-h-[80px]"
        rows={3}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-neutral-400">{value.length}/{MAX_LENGTH}</span>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-black/20 rounded">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || value.trim().length < 2}
            className="px-3 py-1.5 bg-[#b5121b] text-white text-sm font-semibold rounded hover:bg-[#8f0f16] disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditComposer({
  value,
  onChange,
  onCancel,
  onSubmit,
  submitting,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_LENGTH))}
        autoFocus
        className="w-full border border-black/20 rounded-lg p-3 text-sm focus:border-[#b5121b] focus:outline-none resize-y min-h-[80px]"
        rows={3}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-neutral-400">{value.length}/{MAX_LENGTH}</span>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-black/20 rounded">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || value.trim().length < 2}
            className="px-3 py-1.5 bg-neutral-900 text-white text-sm font-semibold rounded hover:bg-black disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportDialog({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (reason: ReportReason, details: string) => void;
}) {
  const [reason, setReason] = useState<ReportReason>("SPAM");
  const [details, setDetails] = useState("");
  return (
    <div className="mt-3 ml-12 bg-neutral-50 border border-black/10 rounded-lg p-4">
      <h4 className="font-semibold text-sm mb-2">Report this comment</h4>
      <div className="space-y-1 mb-3">
        {REPORT_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="report-reason"
              value={o.value}
              checked={reason === o.value}
              onChange={() => setReason(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      <textarea
        placeholder="Additional details (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
        className="w-full border border-black/20 rounded p-2 text-sm focus:border-[#b5121b] focus:outline-none"
        rows={2}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-black/20 rounded">
          Cancel
        </button>
        <button
          onClick={() => onSubmit(reason, details)}
          className="px-3 py-1.5 bg-amber-600 text-white text-sm font-semibold rounded hover:bg-amber-700"
        >
          Submit report
        </button>
      </div>
    </div>
  );
}
