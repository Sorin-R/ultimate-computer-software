/**
 * CategorySortBar — pill-button group used on the "All Categories" page to
 * reorder the grid. Buttons (not a dropdown) for parity with FeedSortBar.
 *
 * Available sorts:
 *   - alphabet      A–Z by name (default)
 *   - articles      categories with the most published articles first
 *   - most_read     categories with the highest total view count
 *   - most_engaging categories with the highest average read-time per view
 *
 * The data needed for each sort is already returned by GET /api/categories
 * (`_count.articles`, `totalViews`, `avgReadTimeSeconds`) so sorting happens
 * entirely on the client — no extra round-trip.
 */

export type CategorySort = "alphabet" | "articles" | "most_read" | "most_engaging";

interface Option {
  value: CategorySort;
  label: string;
  hint: string;
}

export const CATEGORY_SORT_OPTIONS: readonly Option[] = [
  { value: "alphabet", label: "A–Z", hint: "Alphabetical" },
  { value: "articles", label: "Most Articles", hint: "Categories with the largest catalogues first" },
  { value: "most_read", label: "Most Read", hint: "Total views across the category" },
  { value: "most_engaging", label: "Most Engaging", hint: "Highest average read time per article" },
];

interface Props {
  value: CategorySort;
  onChange: (next: CategorySort) => void;
  className?: string;
}

export default function CategorySortBar({ value, onChange, className = "" }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Sort categories"
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {CATEGORY_SORT_OPTIONS.map((opt) => {
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
