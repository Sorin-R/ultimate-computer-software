import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api/client";
import ArticleCard from "../../components/ArticleCard";
import AdBanner from "../../components/AdBanner";
import SEOHead from "../../components/SEOHead";
import FeedSortBar, { type FeedSort } from "../../components/FeedSortBar";
import { useAuth } from "../../context/AuthContext";
import type { ArticleAudioStatus } from "../../utils/articleAudio";
import { getReadingHistoryPayload } from "../../utils/readingHistory";
import { Helmet } from "react-helmet-async";
import { absoluteSiteUrl } from "../../utils/site";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

// Returned by POST /api/home/feed
interface FeedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string };
  views: number;
  averageRating: number;
  ratingCount: number;
}

interface AdConfig {
  placement: string;
  deviceTarget?: "ALL" | "DESKTOP" | "MOBILE";
  isActive?: boolean;
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [category, setCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [sort, setSort] = useState<FeedSort>("recommended");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [activePlacements, setActivePlacements] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateDevice = () => {
      setDevice(mediaQuery.matches ? "mobile" : "desktop");
    };
    updateDevice();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateDevice);
      return () => mediaQuery.removeEventListener("change", updateDevice);
    }

    mediaQuery.addListener(updateDevice);
    return () => mediaQuery.removeListener(updateDevice);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const preferredTarget = device === "mobile" ? "MOBILE" : "DESKTOP";

    api
      .get("/config/adsense", { params: { device } })
      .then((res) => {
        if (cancelled) return;
        const ads = Array.isArray(res.data?.ads) ? (res.data.ads as AdConfig[]) : [];
        const placements = new Set<string>();

        for (const ad of ads) {
          if (!ad?.placement || ad.isActive === false) continue;
          if (ad.deviceTarget === preferredTarget || ad.deviceTarget === "ALL") {
            placements.add(ad.placement);
          }
        }

        setActivePlacements(placements);
      })
      .catch(() => {
        if (!cancelled) setActivePlacements(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [device]);

  const hasPlacementAd = (placement: string): boolean => activePlacements.has(placement);

  // Step 1: load the category metadata (name + description). Cheap call,
  // happens once per slug change.
  useEffect(() => {
    if (!slug) return;
    setNotFound(false);
    api
      .get(`/categories/${slug}`)
      .then((res) => setCategory(res.data.category))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      });
  }, [slug]);

  // Step 2: whenever the slug, sort or page changes, refetch the article list
  // from /home/feed scoped to this category. Same sort semantics as the
  // homepage: "recommended" by default, with anonymous personalisation via
  // localStorage when the user isn't logged in.
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    const body: Record<string, unknown> = {
      sort,
      page,
      limit: 18,
      categorySlug: slug,
    };
    if (!user && sort === "recommended") {
      const payload = getReadingHistoryPayload();
      body.readArticleIds = payload.readArticleIds;
      body.reads = payload.reads;
    }
    api
      .post("/home/feed", body)
      .then((res) => {
        setArticles(Array.isArray(res.data?.articles) ? res.data.articles : []);
        setTotalPages(res.data?.totalPages ?? 1);
      })
      .catch((err) => {
        console.error("category feed fetch failed", err);
        setArticles([]);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [slug, sort, page, user]);

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Category Not Found</h1>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={category?.name ?? "Category"}
        description={
          category?.description ||
          (category ? `Latest ${category.name} news and articles.` : undefined)
        }
        path={category ? `/category/${category.slug}` : undefined}
      />
      {category && (() => {
        const categoryUrl = absoluteSiteUrl(`/category/${category.slug}`);
        const breadcrumbSchema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteSiteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Categories", item: absoluteSiteUrl("/categories") },
            { "@type": "ListItem", position: 3, name: category.name, item: categoryUrl },
          ],
        };
        const collectionPageSchema = {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${category.name} — Ultimate Computer Software`,
          description: category.description || `Latest ${category.name} news and articles.`,
          url: categoryUrl,
          breadcrumb: breadcrumbSchema,
        };
        // L4: ItemList schema for visible article cards
        const itemListSchema = articles.length > 0 ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: articles.slice(0, 10).map((article, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteSiteUrl(`/${article.slug}`),
            name: article.title,
          })),
        } : null;

        return (
          <Helmet>
            {/* M6: Clean canonical enforced by SEOHead's cleanCanonical default */}
            <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
            <script type="application/ld+json">{JSON.stringify(collectionPageSchema)}</script>
            {itemListSchema && (
              <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>
            )}
            <link
              rel="alternate"
              type="application/rss+xml"
              title={`${category.name} RSS Feed`}
              href={`/rss/category/${encodeURIComponent(category.slug)}.xml`}
            />
          </Helmet>
        );
      })()}

      <main className="max-w-7xl mx-auto px-4 py-12">
        <nav className="text-xs text-neutral-500 mb-6 flex items-center gap-1.5" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-neutral-800">Home</Link>
          <span>/</span>
          <Link to="/categories" className="hover:text-neutral-800">Categories</Link>
          <span>/</span>
          <span className="text-neutral-800 font-semibold">{category?.name ?? "…"}</span>
        </nav>
        <div className="mb-8 border-b border-black/15 pb-5">
          <h1 className="text-4xl sm:text-5xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
            {category?.name ?? "Loading…"}
          </h1>
          {category?.description && (
            <p className="text-neutral-700 mt-3">{category.description}</p>
          )}
        </div>

        {hasPlacementAd("category_1") && (
          <div className="mb-8 flex justify-center">
            <div
              className="w-[300px] max-w-full h-[250px] lg:w-full lg:max-w-[970px] lg:h-[90px] flex items-center justify-center"
            >
              <AdBanner
                placement="category_1"
                variant="flat"
                className="w-full h-full flex items-center justify-center"
              />
            </div>
          </div>
        )}

        {/* Sort buttons (Recommended is the default) */}
        <div className="flex justify-end mb-6">
          <FeedSortBar
            value={sort}
            onChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
          </div>
        ) : articles.length === 0 ? (
          <p className="text-center py-16 text-neutral-500">
            No articles in this category yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.slice(0, 3).map((article) => (
                <ArticleCard
                  key={article.id}
                  title={article.title}
                  slug={article.slug}
                  excerpt={article.excerpt}
                  authorName={article.authorName}
                  publishedAt={article.publishedAt}
                  imageUrl={article.imageUrl}
                  audioUrl={article.audioUrl}
                  audioStatus={article.audioStatus}
                  category={{ name: article.category.name, slug: article.category.slug }}
                  rating={{ average: article.averageRating, count: article.ratingCount }}
                  views={{ totalViews: article.views }}
                />
              ))}
            </div>
            
            {hasPlacementAd("category_2") && (
              <div className="my-8 flex justify-center">
                <div
                  className="flex items-center justify-center"
                  style={{ width: "970px", maxWidth: "100%", height: "250px" }}
                >
                  <AdBanner
                    placement="category_2"
                    variant="flat"
                    className="w-full h-full flex items-center justify-center"
                  />
                </div>
              </div>
            )}

            {articles.length > 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.slice(3).map((article) => (
                  <ArticleCard
                    key={article.id}
                    title={article.title}
                    slug={article.slug}
                    excerpt={article.excerpt}
                    authorName={article.authorName}
                    publishedAt={article.publishedAt}
                    imageUrl={article.imageUrl}
                    audioUrl={article.audioUrl}
                    audioStatus={article.audioStatus}
                    category={{ name: article.category.name, slug: article.category.slug }}
                    rating={{ average: article.averageRating, count: article.ratingCount }}
                    views={{ totalViews: article.views }}
                  />
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-neutral-600 text-sm">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
