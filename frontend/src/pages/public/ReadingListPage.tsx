import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import ArticleListenBadge from "../../components/ArticleListenBadge";
import { useAuth } from "../../context/AuthContext";
import { hasReadyAudio, type ArticleAudioStatus } from "../../utils/articleAudio";
import { getImageUrl } from "../../utils/imageUrl";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  publishedAt: string | null;
  category: { name: string; slug: string };
}

interface ListItem {
  id: string;
  position: number;
  addedAt: string;
  article: Article & { status: string };
}

interface ReadingList {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  creator: { id: string; name: string };
  followCount: number;
  isFollowing: boolean;
  items: ListItem[];
  createdAt: string;
}

export default function ReadingListPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [list, setList] = useState<ReadingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api
      .get(`/reading-lists/${slug}`)
      .then((res) => setList(res.data.list))
      .catch((e) => setError(e.response?.data?.error || "Reading list not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  const toggleFollow = async () => {
    if (!list || !user) return;
    try {
      const res = await api.post<{ following: boolean; followCount: number }>(
        `/reading-lists/${list.id}/follow`
      );
      setList((l) => l ? { ...l, isFollowing: res.data.following, followCount: res.data.followCount } : l);
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to update follow");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-neutral-500">{error || "Reading list not found"}</p>
        <Link to="/reading-lists" className="text-[#b5121b] hover:underline mt-4 block">
          ← All Reading Lists
        </Link>
      </div>
    );
  }

  const publishedItems = list.items.filter((i) => i.article.status === "PUBLISHED");

  return (
    <>
      <SEOHead
        title={`${list.title} — Reading List`}
        description={list.description || `A curated reading list by ${list.creator.name}`}
        path={`/reading-list/${list.slug}`}
      />

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/reading-lists" className="text-xs text-neutral-500 hover:text-neutral-900 uppercase tracking-wide">
            ← Reading Lists
          </Link>
          <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mt-3">
            {list.title}
          </h1>
          {list.description && (
            <p className="text-neutral-600 mt-2">{list.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-neutral-500">
            <span>
              Curated by{" "}
              <Link to={`/author/${list.creator.id}`} className="text-neutral-900 hover:underline font-medium">
                {list.creator.name}
              </Link>
            </span>
            <span>·</span>
            <span>{publishedItems.length} article{publishedItems.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{list.followCount} follower{list.followCount !== 1 ? "s" : ""}</span>
          </div>
          {user && (
            <button
              onClick={toggleFollow}
              className={`mt-4 px-5 py-2 text-sm font-semibold border transition-colors ${
                list.isFollowing
                  ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-700"
                  : "border-black/25 text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {list.isFollowing ? "✓ Following" : "+ Follow this list"}
            </button>
          )}
        </div>

        {/* Articles */}
        {publishedItems.length === 0 ? (
          <p className="text-neutral-500 text-center py-10">No published articles in this list yet.</p>
        ) : (
          <ol className="space-y-4">
            {publishedItems.map((item, idx) => (
              <li key={item.id} className="flex gap-4">
                <span className="text-2xl font-bold text-neutral-200 shrink-0 w-8 text-right leading-tight mt-1">
                  {idx + 1}
                </span>
                <div className="flex-1 bg-white border border-black/15 p-4 hover:border-black/30 transition-colors">
                  <div className="flex gap-3">
                    {item.article.imageUrl && (
                      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded">
                        {hasReadyAudio(item.article) && (
                          <ArticleListenBadge size="sm" className="left-1 top-1 px-1 py-0.5" />
                        )}
                        <img
                          src={getImageUrl(item.article.imageUrl) || undefined}
                          alt={item.article.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/${item.article.slug}`}
                        className="font-bold text-neutral-900 hover:text-[#b5121b] leading-snug block"
                      >
                        {item.article.title}
                      </Link>
                      {item.article.excerpt && (
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                          {item.article.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-400">
                        <span>{item.article.authorName}</span>
                        <span>·</span>
                        <Link
                          to={`/category/${item.article.category.slug}`}
                          className="hover:underline"
                        >
                          {item.article.category.name}
                        </Link>
                        {item.article.publishedAt && (
                          <>
                            <span>·</span>
                            <span>{new Date(item.article.publishedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
