/**
 * R5: Full-text search with filters.
 * URL params keep state shareable: ?q=foo&category=ai&tag=ml&authorId=...&from=2026-01-01&to=2026-12-31
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import ArticleCard from "../../components/ArticleCard";
import type { ArticleAudioStatus } from "../../utils/articleAudio";
import { X } from "lucide-react";

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

interface Facets {
  categories: { id: string; name: string; slug: string; articleCount: number }[];
  tags: { id: string; name: string; slug: string; articleCount: number }[];
  authors: { id: string; name: string; isVerified: boolean; articleCount: number }[];
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const tag = params.get("tag") || "";
  const authorId = params.get("authorId") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = Math.max(1, parseInt(params.get("page") || "1"));

  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Local form state (synced from URL on mount + on URL changes)
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);

  // Load filter facets once
  useEffect(() => {
    api.get<Facets>("/articles/search/facets").then((res) => setFacets(res.data)).catch(() => {});
  }, []);

  // Run search whenever URL params change
  useEffect(() => {
    setLoading(true);
    api
      .get("/articles", {
        params: {
          search: q || undefined,
          category: category || undefined,
          tag: tag || undefined,
          authorId: authorId || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit: 12,
        },
      })
      .then((res) => {
        setArticles(res.data.articles);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q, category, tag, authorId, from, to, page]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page"); // reset paging on filter change
    setParams(next, { replace: true });
  };

  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParam("q", searchInput.trim());
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (category) n++;
    if (tag) n++;
    if (authorId) n++;
    if (from || to) n++;
    return n;
  }, [category, tag, authorId, from, to]);

  return (
    <>
      <SEOHead
        title={q ? `Search: ${q}` : "Search Articles"}
        description="Search worldwide technology news with filters by category, topic, author and date."
        path="/search"
        // M9: noindex search result pages so parameterised URLs don't create
        // thin content in the index. The clean /search page itself stays indexable.
        noindex={!!q}
      />
      {tag && (
        <Helmet>
          <link
            rel="alternate"
            type="application/rss+xml"
            title={`Tag ${tag} RSS Feed`}
            href={`/rss/tag/${encodeURIComponent(tag)}.xml`}
          />
        </Helmet>
      )}

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Search bar */}
        <form onSubmit={onSearchSubmit} className="mb-6 flex gap-2 flex-wrap">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search articles, authors, content…"
            autoFocus
            className="flex-1 min-w-[260px] border border-black/20 px-4 py-3 text-sm focus:outline-none focus:border-[#b5121b]"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800"
          >
            Search
          </button>
          {(q || activeFilterCount > 0) && (
            <button
              type="button"
              onClick={clearAll}
              className="px-4 py-3 border border-black/20 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              Clear
            </button>
          )}
        </form>

        {/* Mobile filter toggle button */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="w-full px-4 py-3 border border-black/20 bg-white text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
          >
            {filtersOpen ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        {/* Mobile filter overlay scrim */}
        {filtersOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/20 z-40"
            onClick={() => setFiltersOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
          {/* Filter sidebar */}
          <aside className={`lg:col-span-3 lg:block min-w-0 ${
            filtersOpen
              ? "fixed inset-x-0 top-0 bottom-0 w-full max-w-full bg-white z-50 overflow-y-auto overflow-x-hidden pt-16 px-4"
              : "hidden"
          }`}>
            <div className="lg:sticky lg:top-24 space-y-6 pb-8">
              <div className="flex items-center justify-between lg:block">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-700">
                      Filters
                    </h3>
                    {activeFilterCount > 0 && (
                      <span className="text-xs text-[#b5121b] font-semibold">
                        {activeFilterCount} active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Narrow your results.
                  </p>
                </div>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="lg:hidden p-2 text-neutral-700 hover:text-neutral-900 ml-4"
                  aria-label="Close filters"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Date range */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-800 mb-2">Published date</h4>
                <div className="grid grid-cols-1 gap-2 min-w-0">
                  <label className="block text-[11px] text-neutral-500 min-w-0">From
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setParam("from", e.target.value)}
                      className="search-date-input mt-1 block w-full max-w-full min-w-0 border border-black/20 px-2 py-1.5 text-xs focus:outline-none focus:border-[#b5121b]"
                    />
                  </label>
                  <label className="block text-[11px] text-neutral-500 min-w-0">To
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setParam("to", e.target.value)}
                      className="search-date-input mt-1 block w-full max-w-full min-w-0 border border-black/20 px-2 py-1.5 text-xs focus:outline-none focus:border-[#b5121b]"
                    />
                  </label>
                </div>
              </div>

              {/* Categories */}
              {facets && facets.categories.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-800 mb-2">Category</h4>
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    <button
                      onClick={() => setParam("category", "")}
                      className={`w-full text-left text-xs px-2 py-1 rounded ${
                        !category ? "bg-[#b5121b]/10 text-[#8f0f16] font-semibold" : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      All categories
                    </button>
                    {facets.categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setParam("category", c.slug)}
                        className={`w-full text-left text-xs px-2 py-1 rounded flex justify-between ${
                          category === c.slug
                            ? "bg-[#b5121b]/10 text-[#8f0f16] font-semibold"
                            : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="opacity-50 ml-2">{c.articleCount}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {facets && facets.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-800 mb-2">Topic</h4>
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    <button
                      onClick={() => setParam("tag", "")}
                      className={`w-full text-left text-xs px-2 py-1 rounded ${
                        !tag ? "bg-[#b5121b]/10 text-[#8f0f16] font-semibold" : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      All topics
                    </button>
                    {facets.tags.slice(0, 80).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setParam("tag", t.slug)}
                        className={`w-full text-left text-xs px-2 py-1 rounded flex justify-between ${
                          tag === t.slug
                            ? "bg-[#b5121b]/10 text-[#8f0f16] font-semibold"
                            : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        <span className="truncate">#{t.name}</span>
                        <span className="opacity-50 ml-2">{t.articleCount}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Authors */}
              {facets && facets.authors.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-800 mb-2">Author</h4>
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    <button
                      onClick={() => setParam("authorId", "")}
                      className={`w-full text-left text-xs px-2 py-1 rounded ${
                        !authorId ? "bg-[#b5121b]/10 text-[#8f0f16] font-semibold" : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      All authors
                    </button>
                    {facets.authors.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setParam("authorId", a.id)}
                        className={`w-full text-left text-xs px-2 py-1 rounded flex justify-between ${
                          authorId === a.id
                            ? "bg-[#b5121b]/10 text-[#8f0f16] font-semibold"
                            : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {a.name}
                          {a.isVerified && <span className="text-blue-500" title="Verified">✓</span>}
                        </span>
                        <span className="opacity-50 ml-2">{a.articleCount}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Results */}
          <main className="lg:col-span-9">
            <header className="mb-5 flex items-center justify-between flex-wrap gap-2">
              <h1 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
                {q ? <>Results for "<span className="text-[#b5121b]">{q}</span>"</> : "Search Articles"}
              </h1>
              <span className="text-sm text-neutral-500">
                {loading ? "Searching…" : `${total} article${total !== 1 ? "s" : ""}`}
              </span>
            </header>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {category && facets && (
                  <FilterChip
                    label={`Category: ${facets.categories.find((c) => c.slug === category)?.name || category}`}
                    onRemove={() => setParam("category", "")}
                  />
                )}
                {tag && facets && (
                  <FilterChip
                    label={`Topic: #${facets.tags.find((t) => t.slug === tag)?.name || tag}`}
                    onRemove={() => setParam("tag", "")}
                  />
                )}
                {authorId && facets && (
                  <FilterChip
                    label={`Author: ${facets.authors.find((a) => a.id === authorId)?.name || "—"}`}
                    onRemove={() => setParam("authorId", "")}
                  />
                )}
                {(from || to) && (
                  <FilterChip
                    label={`Date: ${from || "any"} → ${to || "any"}`}
                    onRemove={() => { setParam("from", ""); setParam("to", ""); }}
                  />
                )}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
              </div>
            ) : articles.length === 0 ? (
              <div className="bg-white border border-black/10 p-10 text-center">
                <p className="text-neutral-500 mb-2">
                  {q || activeFilterCount > 0
                    ? "No articles found matching your search."
                    : "Enter a search term or pick a filter to begin."}
                </p>
                {(q || activeFilterCount > 0) && (
                  <button onClick={clearAll} className="text-[#b5121b] hover:underline text-sm font-semibold">
                    Clear all
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {articles.map((a) => (
                    <ArticleCard key={a.id} {...a} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center gap-3 mt-10">
                    <button
                      onClick={() => setParam("page", String(Math.max(1, page - 1)))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-neutral-500">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setParam("page", String(Math.min(totalPages, page + 1)))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-black/20 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            {!loading && articles.length === 0 && q && (
              <div className="mt-6 text-center">
                <Link to="/" className="text-sm text-[#b5121b] hover:underline">
                  ← Back to home
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#b5121b]/10 text-[#8f0f16] text-xs font-semibold rounded-full">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-[#b5121b]/20 rounded-full w-4 h-4 flex items-center justify-center text-sm leading-none"
        aria-label="Remove filter"
      >
        ×
      </button>
    </span>
  );
}
