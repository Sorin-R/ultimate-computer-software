/**
 * FeedSortBar — horizontal pill-button group for switching the sort order of
 * an article feed. Used in both the homepage "Latest News" section and the
 * category page. Buttons (not a dropdown) per design requirement.
 *
 * The available sorts mirror what /api/home/feed accepts:
 *   - recommended (default; uses the same favourite-category algorithm as the
 *     homepage Main Article — personalised even for anonymous users via
 *     localStorage)
 *   - latest      (newest first)
 *   - most_read   (total views, all-time)
 *   - top_rated   (highest avg rating; needs ≥3 reviews to be eligible)
 *   - trending    (most views in the last 7 days)
 */

export type FeedSort =
  | "recommended"
  | "latest"
  | "most_read"
  | "top_rated"
  | "trending";

interface Option {
  value: FeedSort;
  label: string;
  hint: string;
}

export const FEED_SORT_OPTIONS: readonly Option[] = [
  { value: "recommended", label: "For You", hint: "Personalised picks based on what you read" },
  { value: "latest", label: "Latest", hint: "Newest articles first" },
  { value: "trending", label: "Trending", hint: "Most read in the last 7 days" },
  { value: "most_read", label: "Most Read", hint: "Highest total views all-time" },
  { value: "top_rated", label: "Top Rated", hint: "Highest reader rating (3+ reviews)" },
];

interface Props {
  value: FeedSort;
  onChange: (next: FeedSort) => void;
  className?: string;
}

export default function FeedSortBar({ value, onChange, className = "" }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Sort articles"
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {FEED_SORT_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold uppercase tracking-[0.06em] border transition-colors ${
              active
                ? "bg-black text-white border-black"
                : "bg-white text-neutral-700 border-black/20 hover:bg-neutral-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
