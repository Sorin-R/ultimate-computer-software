import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Stars, InteractiveStars } from "./Stars";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

interface Stats {
  count: number;
  average: number;
}

interface Props {
  /** Article slug, used to fetch and post reviews. */
  slug: string;
  /** Initial stats from the article-detail response (count + average). */
  initialStats: Stats;
  /** UserId of the article author — they cannot review their own article. */
  authorUserId?: string | null;
  /** Render without the standalone page section wrapper. */
  embedded?: boolean;
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ratingDistribution(reviews: Review[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
  }
  return dist;
}

export default function ArticleReviews({ slug, initialStats, authorUserId, embedded = false }: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickedRating, setPickedRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Pre-fill the form if the user has already left a review for this article.
  const myExistingReview = user ? reviews.find((r) => r.user.id === user.id) : undefined;
  const isAuthor = !!user && !!authorUserId && user.id === authorUserId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/articles/${slug}/reviews`)
      .then((res) => {
        if (cancelled) return;
        setReviews(res.data.reviews as Review[]);
        setStats(res.data.stats as Stats);
      })
      .catch(() => {
        // Non-fatal — leave empty list.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Sync the form with an existing review the first time we know about it.
  useEffect(() => {
    if (myExistingReview) {
      setPickedRating(myExistingReview.rating);
      setComment(myExistingReview.comment ?? "");
    }
  }, [myExistingReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);

    if (pickedRating < 1 || pickedRating > 5) {
      setSubmitError("Please select a star rating between 1 and 5.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post(`/articles/${slug}/reviews`, {
        rating: pickedRating,
        comment: comment.trim() || undefined,
      });
      const newReview = data.review as Review;
      setStats(data.stats as Stats);
      setReviews((prev) => {
        const without = prev.filter((r) => r.user.id !== newReview.user.id);
        return [newReview, ...without];
      });
      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.error || err?.message || "Failed to submit review"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const dist = ratingDistribution(reviews);
  const totalForBars = Math.max(1, reviews.length);

  return (
    <section className={embedded ? "" : "bg-white border-t border-black/15"}>
      <div className={embedded ? "max-w-none px-0 py-0" : "max-w-4xl mx-auto px-4 py-12"}>
        <h2 className="text-3xl sm:text-4xl font-bold mb-2 [font-family:Georgia,'Times_New_Roman',serif]">
          Reader Ratings &amp; Reviews
        </h2>
        <p className="text-sm text-neutral-600 mb-8">
          Share your honest opinion to help other readers.
        </p>

        {/* Summary block */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-8 pb-8 border-b border-black/15">
          <div className="text-center sm:text-left">
            <div className="text-5xl font-bold text-neutral-900 leading-none">
              {stats.average.toFixed(1)}
            </div>
            <div className="mt-2 flex justify-center sm:justify-start">
              <Stars value={stats.average} size={20} />
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Based on {stats.count} {stats.count === 1 ? "review" : "reviews"}
            </p>
          </div>

          {/* Histogram bars 5★ → 1★ */}
          {reviews.length > 0 && (
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = dist[star as 1 | 2 | 3 | 4 | 5];
                const pct = (count / totalForBars) * 100;
                return (
                  <div key={star} className="flex items-center gap-3 text-xs text-neutral-700">
                    <span className="w-10 text-right tabular-nums">{star} star</span>
                    <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neutral-900 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 tabular-nums text-neutral-500">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submission form */}
        <div className="py-8 border-b border-black/15">
          <h3 className="text-lg font-bold text-neutral-900 mb-3">
            {myExistingReview ? "Update your review" : "Write a review"}
          </h3>

          {!user ? (
            <div className="rounded-lg bg-neutral-50 border border-black/15 p-4 text-sm text-neutral-700">
              Please <Link to="/login" className="font-semibold text-[#b5121b] hover:underline">log in</Link> or{" "}
              <Link to="/register" className="font-semibold text-[#b5121b] hover:underline">create an account</Link>{" "}
              to leave a rating and feedback.
            </div>
          ) : isAuthor ? (
            <div className="rounded-lg bg-neutral-50 border border-black/15 p-4 text-sm text-neutral-700">
              You cannot review your own article.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-800 mb-2">
                  Your rating
                </label>
                <InteractiveStars
                  value={pickedRating}
                  onChange={setPickedRating}
                  disabled={submitting}
                />
                {pickedRating > 0 && (
                  <p className="text-xs text-neutral-500 mt-1">
                    {pickedRating} out of 5
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-800 mb-2" htmlFor="review-comment">
                  Your feedback <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you find useful or unclear about this article?"
                  rows={4}
                  maxLength={2000}
                  className="w-full px-4 py-3 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b] resize-y"
                />
                <p className="text-xs text-neutral-500 mt-1">{comment.length}/2000</p>
              </div>

              {submitError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-800">
                  {submitError}
                </div>
              )}
              {submitSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
                  Thanks! Your review has been saved.
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting || pickedRating === 0}
                  className="px-5 py-2.5 bg-[#b5121b] text-white font-semibold rounded-lg hover:bg-[#8f0f16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Submitting…" : myExistingReview ? "Update review" : "Submit review"}
                </button>
                {myExistingReview && (
                  <span className="text-xs text-neutral-500">
                    You already reviewed this article on {formatReviewDate(myExistingReview.createdAt)}.
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Reviews list */}
        <div className="pt-8">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            All reviews ({stats.count})
          </h3>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-neutral-900 border-t-transparent" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-neutral-600 py-8 text-center">
              No reviews yet. Be the first to share your thoughts.
            </p>
          ) : (
            <ul className="divide-y divide-black/10">
              {reviews.map((r) => (
                <li key={r.id} className="py-5">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="font-semibold text-neutral-900">{r.user.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={r.rating} size={16} />
                        <span className="text-xs text-neutral-500">
                          {formatReviewDate(r.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {r.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
