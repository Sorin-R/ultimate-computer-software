import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { useAuth } from "../../context/AuthContext";

interface ReadingListSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  creator: { id: string; name: string };
  itemCount: number;
  followCount: number;
  isFollowing: boolean;
  createdAt: string;
}

export default function ReadingListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ReadingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    api
      .get("/reading-lists", { params: { page } })
      .then((res) => {
        setLists(res.data.lists);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const toggleFollow = async (listId: string) => {
    if (!user) return;
    try {
      const res = await api.post<{ following: boolean; followCount: number }>(`/reading-lists/${listId}/follow`);
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId
            ? { ...l, isFollowing: res.data.following, followCount: res.data.followCount }
            : l
        )
      );
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to update follow");
    }
  };

  return (
    <>
      <SEOHead
        title="Reading Lists — Ultimate Computer Software"
        description="Discover curated reading lists on tech topics. Follow the ones that interest you."
        path="/reading-lists"
      />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
              Reading Lists
            </h1>
            <p className="text-neutral-500 mt-1 text-sm">
              {total} curated list{total !== 1 ? "s" : ""} from the community
            </p>
          </div>
          {user && (
            <Link
              to="/dashboard/reading-lists"
              className="px-4 py-2 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800"
            >
              My Lists
            </Link>
          )}
        </header>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : lists.length === 0 ? (
          <p className="text-center text-neutral-500 py-10">No reading lists yet. Be the first to create one!</p>
        ) : (
          <ul className="space-y-4">
            {lists.map((list) => (
              <li key={list.id} className="bg-white border border-black/15 p-5 hover:border-black/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/reading-list/${list.slug}`}
                      className="font-bold text-neutral-900 hover:text-[#b5121b] text-base leading-snug block"
                    >
                      {list.title}
                    </Link>
                    {list.description && (
                      <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{list.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
                      <span>by {list.creator.name}</span>
                      <span>·</span>
                      <span>{list.itemCount} article{list.itemCount !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>{list.followCount} follower{list.followCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  {user && (
                    <button
                      onClick={() => toggleFollow(list.id)}
                      className={`shrink-0 px-3 py-1.5 text-xs font-semibold border transition-colors ${
                        list.isFollowing
                          ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-700"
                          : "border-black/25 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {list.isFollowing ? "Following" : "+ Follow"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-neutral-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
