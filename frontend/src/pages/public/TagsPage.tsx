/**
 * K9: Tags / Topics page — lists all tags with follow buttons so users can
 * subscribe to per-tag feeds.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import TagFollowButton from "../../components/TagFollowButton";
import { useAuth } from "../../context/AuthContext";

interface TagItem {
  id: string;
  name: string;
  slug: string;
  category: { name: string; slug: string } | null;
  followCount: number;
  articleCount: number;
  isFollowing: boolean;
}

export default function TagsPage() {
  const { user } = useAuth();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get("/tags")
      .then((res) => setTags(res.data.tags))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? tags.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : tags;

  return (
    <>
      <SEOHead
        title="Topics & Tags — Ultimate Computer Software"
        description="Browse technology topics and follow the tags you care about for a personalised feed."
        path="/tags"
      />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
                Topics & Tags
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Follow tags to build a personalised feed of articles you care about.
              </p>
            </div>
            {user && (
              <Link
                to="/dashboard/tag-feed"
                className="px-4 py-2 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800"
              >
                My Tag Feed
              </Link>
            )}
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics…"
            className="mt-4 w-full max-w-sm border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-[#b5121b]"
          />
        </header>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-neutral-500 text-center py-10">No topics found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((tag) => (
              <div
                key={tag.id}
                className="bg-white border border-black/15 p-4 flex items-start justify-between gap-3 hover:border-black/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-neutral-900 truncate">#{tag.name}</span>
                  </div>
                  {tag.category && (
                    <Link
                      to={`/category/${tag.category.slug}`}
                      className="text-xs text-neutral-400 hover:underline"
                    >
                      {tag.category.name}
                    </Link>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                    <span>{tag.articleCount} article{tag.articleCount !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{tag.followCount} follower{tag.followCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <TagFollowButton
                  tagSlug={tag.slug}
                  tagName={tag.name}
                  initialFollowing={tag.isFollowing}
                  followCount={tag.followCount}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
