import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import CreatorAvatar from "../../components/CreatorAvatar";
import { useAuth } from "../../context/AuthContext";
import { absoluteSiteUrl } from "../../utils/site";

/**
 * Dashboard → Profile editor.
 *
 *  - Edit public bio + avatar URL (C2: author profile)
 *  - Pick / clear a pinned article (C9: pinned article on profile)
 *
 * The avatar is a URL field rather than a file upload to stay consistent with
 * the rest of the project's image-by-URL pattern. Future improvement: hook
 * into the existing /api/upload to attach a file.
 */

interface MyArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
}

interface MyProfile {
  bio: string | null;
  avatarUrl: string | null;
  pinnedArticleId: string | null;
}

export default function ProfileEditor() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MyProfile>({
    bio: "",
    avatarUrl: "",
    pinnedArticleId: null,
  });
  const [articles, setArticles] = useState<MyArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Initial load: pull the current user's profile via the public author
  // endpoint (it returns bio + avatarUrl) and the user's own articles list.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, articlesRes] = await Promise.all([
          api.get(`/users/${user.id}/profile`),
          api.get("/articles/mine"),
        ]);
        if (cancelled) return;
        setProfile({
          bio: profileRes.data?.author?.bio ?? "",
          avatarUrl: profileRes.data?.author?.avatarUrl ?? "",
          pinnedArticleId: profileRes.data?.pinnedArticle?.id ?? null,
        });
        setArticles(
          Array.isArray(articlesRes.data?.articles)
            ? articlesRes.data.articles
            : []
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/me/profile", {
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      });
      // Pinned article is a separate endpoint (it has stricter validation).
      await api.put("/me/pinned-article", {
        articleId: profile.pinnedArticleId,
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      alert(err?.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  const publishedArticles = articles.filter((a) => a.status === "PUBLISHED");
  const embedUrl = absoluteSiteUrl(`/embed/author/${user.id}`);
  const embedCode = `<iframe src=\"${embedUrl}\" title=\"${user.name} author card\" width=\"420\" height=\"240\" style=\"max-width:100%;border:0;\" loading=\"lazy\"></iframe>`;

  return (
    <>
      <SEOHead title="Edit Profile" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
          Profile
        </h1>
        <Link
          to={`/author/${user.id}`}
          className="text-xs uppercase tracking-[0.08em] text-[#b5121b] hover:underline"
        >
          View public profile →
        </Link>
      </div>

      <div className="bg-white border border-black/15 p-5 max-w-3xl">
        {/* Avatar preview */}
        <div className="flex items-center gap-4 mb-6">
          <CreatorAvatar
            name={user.name}
            avatarUrl={profile.avatarUrl || null}
            size={72}
          />
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
              Avatar URL
            </label>
            <input
              type="url"
              value={profile.avatarUrl ?? ""}
              onChange={(e) =>
                setProfile((p) => ({ ...p, avatarUrl: e.target.value }))
              }
              placeholder="https://example.com/avatar.jpg"
              className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Leave empty to fall back to your initials.
            </p>
          </div>
        </div>

        {/* Bio */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
            Bio
          </label>
          <textarea
            rows={5}
            maxLength={2000}
            value={profile.bio ?? ""}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            placeholder="Tell readers a little about yourself…"
            className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none resize-y"
          />
          <p className="text-[11px] text-neutral-400 mt-1">
            {(profile.bio ?? "").length} / 2000 characters
          </p>
        </div>

        {/* Pinned article */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
            Pinned article
          </label>
          {publishedArticles.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">
              You don't have any published articles to pin yet.
            </p>
          ) : (
            <select
              value={profile.pinnedArticleId ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  pinnedArticleId: e.target.value || null,
                }))
              }
              className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none"
            >
              <option value="">— No pinned article —</option>
              {publishedArticles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          )}
          <p className="text-[11px] text-neutral-400 mt-1">
            The pinned article is highlighted at the top of your public author
            page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-[#b5121b] text-white text-sm font-semibold uppercase tracking-[0.08em] hover:bg-[#8f0f16] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {savedAt && (
            <span className="text-xs text-green-700">Saved at {savedAt}</span>
          )}
        </div>
      </div>

      <div className="bg-white border border-black/15 p-5 max-w-3xl mt-6">
        <h2 className="text-xl font-semibold mb-2">Embed My Profile</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Copy and paste this embed code on your website.
        </p>
        <textarea
          readOnly
          value={embedCode}
          rows={4}
          className="w-full border border-black/20 px-3 py-2 text-xs bg-neutral-50"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(embedCode);
            alert("Embed code copied");
          }}
          className="mt-3 px-4 py-2 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800"
        >
          Copy Embed Code
        </button>
      </div>
    </>
  );
}
