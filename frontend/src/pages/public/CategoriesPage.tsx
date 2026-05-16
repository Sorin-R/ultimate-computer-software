import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import CategorySortBar, {
  CATEGORY_SORT_OPTIONS,
  type CategorySort,
} from "../../components/CategorySortBar";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count: { articles: number };
  // Engagement metrics returned by GET /api/categories so the page can sort
  // by reader engagement client-side. Optional so the page is robust to
  // older API responses.
  avgReadTimeSeconds?: number;
  totalViews?: number;
}

/** Format seconds as a compact human label (e.g. "2m 30s" or "45s"). */
function formatReadTime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<CategorySort>("alphabet");

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data.categories))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Sort entirely client-side — the backend already returns every metric we
  // need. Each sort uses `name.localeCompare(...)` as a final tie-breaker so
  // the order is stable and predictable.
  const sortedCategories = useMemo(() => {
    const arr = [...categories];
    if (sort === "articles") {
      arr.sort((a, b) => {
        const ac = a._count?.articles ?? 0;
        const bc = b._count?.articles ?? 0;
        if (bc !== ac) return bc - ac;
        return a.name.localeCompare(b.name);
      });
    } else if (sort === "most_read") {
      arr.sort((a, b) => {
        const av = a.totalViews ?? 0;
        const bv = b.totalViews ?? 0;
        if (bv !== av) return bv - av;
        return a.name.localeCompare(b.name);
      });
    } else if (sort === "most_engaging") {
      arr.sort((a, b) => {
        const ae = a.avgReadTimeSeconds ?? 0;
        const be = b.avgReadTimeSeconds ?? 0;
        if (be !== ae) return be - ae;
        return a.name.localeCompare(b.name);
      });
    } else {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [categories, sort]);

  // Pull the active sort label so the page heading matches the active button
  // (same pattern as the homepage Latest News section).
  const activeLabel =
    CATEGORY_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "All Categories";

  return (
    <>
      <SEOHead
        title="All Categories"
        description="Browse all technology news categories on Ultimate Computer Software."
        path="/categories"
      />

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
            {sort === "alphabet" ? "All Categories" : activeLabel}
          </h1>
          <CategorySortBar value={sort} onChange={setSort} />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
          </div>
        ) : sortedCategories.length === 0 ? (
          <p className="text-center py-16 text-neutral-500">No categories yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                className="block p-6 bg-white border border-black/15 hover:border-black/35 transition-all"
              >
                <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-2">
                  {cat.name}
                </h2>
                {cat.description && (
                  <p className="text-neutral-700 text-sm mb-3 line-clamp-2">{cat.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.1em]">
                  <span className="text-[#b5121b] font-semibold">
                    {cat._count.articles} article{cat._count.articles !== 1 ? "s" : ""}
                  </span>
                  {typeof cat.totalViews === "number" && cat.totalViews > 0 && (
                    <span className="text-neutral-500">
                      • {cat.totalViews.toLocaleString()} reads
                    </span>
                  )}
                  {typeof cat.avgReadTimeSeconds === "number" &&
                    cat.avgReadTimeSeconds > 0 && (
                      <span className="text-neutral-500">
                        • {formatReadTime(cat.avgReadTimeSeconds)} avg read
                      </span>
                    )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
