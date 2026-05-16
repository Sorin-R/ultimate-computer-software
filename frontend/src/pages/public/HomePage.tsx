import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { Helmet } from "react-helmet-async";
import { cleanExcerptText } from "../../utils/contentText";
import { hasReadyAudio, type ArticleAudioStatus } from "../../utils/articleAudio";
import { getImageUrl } from "../../utils/imageUrl";
import { getReadingHistoryPayload } from "../../utils/readingHistory";
import { useAuth } from "../../context/AuthContext";
import AdBanner from "../../components/AdBanner";
import { Stars } from "../../components/Stars";
import FeedSortBar, { FEED_SORT_OPTIONS, type FeedSort } from "../../components/FeedSortBar";
import CreatorAvatar from "../../components/CreatorAvatar";
import AmaBanner from "../../components/AmaBanner";
import ArticleListenBadge from "../../components/ArticleListenBadge";

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
  rating?: { average: number; count: number };
  views?: { totalViews: number };
}

// Returned by POST /api/home/main-article. Personalised lead article.
interface MainArticle {
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

// Returned by POST /api/home/feed.
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

interface TopStoryArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  publishedAt: string | null;
  createdAt: string;
  publishedDate: string;
  category: { name: string; slug: string };
  views: number;
  averageRating: number;
  ratingCount: number;
  topStoryScore: number;
}

type StorySort = "top_stories" | "most_read" | "most_rated" | "highest_rating";

interface AdConfig {
  placement: string;
  deviceTarget?: "ALL" | "DESKTOP" | "MOBILE";
  isActive?: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
  avgReadTimeSeconds?: number;
  totalViews?: number;
}

const STORY_SORT_OPTIONS: { value: StorySort; label: string }[] = [
  { value: "top_stories", label: "Top Stories" },
  { value: "most_read", label: "Most Read" },
  { value: "most_rated", label: "Most Rated" },
  { value: "highest_rating", label: "Highest Rating" },
];

function formatArticleDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getAllTimeZones(): string[] {
  const intlWithSupported = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };

  const zones = typeof intlWithSupported.supportedValuesOf === "function"
    ? intlWithSupported.supportedValuesOf("timeZone")
    : [];
  const browserZone = getBrowserTimeZone();

  if (zones.length === 0) {
    return browserZone === "UTC" ? ["UTC"] : [browserZone, "UTC"];
  }

  if (!zones.includes(browserZone)) {
    return [browserZone, ...zones];
  }

  return zones;
}

function formatClock(date: Date, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone,
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).formatToParts(date);
  }

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("month")} ${value("day")}, ${value("year")} ${value("hour")}:${value("minute")}:${value("second")} ${value("dayPeriod")}`;
}

function formatTimeZoneShortLabel(zone: string): string {
  if (!zone || zone === "UTC" || zone === "Etc/UTC") {
    return "UTC";
  }

  const zoneParts = zone.split("/");
  const cityToken = zoneParts[zoneParts.length - 1] || zone;
  const cleanedCity = cityToken.replace(/_/g, " ").trim();
  const words = cleanedCity.split(/[\s-]+/).filter(Boolean);

  if (words.length >= 2) {
    return words.map((word) => word[0]).join("").toUpperCase().slice(0, 4);
  }

  const single = words[0] || cityToken;
  if (single.length <= 3) {
    return single.toUpperCase();
  }

  return single.slice(0, 3).toUpperCase();
}

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const location = useLocation();
  const { user } = useAuth();

  // The navbar "Latest" link points at /latest. When the user is on that
  // route we override the homepage's personalisation: the main article shows
  // the latest published article overall, and the Latest News list defaults
  // to the "latest" sort. Both can still be switched manually via the sort
  // bar — the override only changes the *defaults*.
  const isLatestRoute = location.pathname === "/latest";

  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedStorySort, setSelectedStorySort] = useState<StorySort>("top_stories");
  const [topStories, setTopStories] = useState<TopStoryArticle[]>([]);
  const [topStoriesLoading, setTopStoriesLoading] = useState(true);
  const [topStoriesError, setTopStoriesError] = useState<string | null>(null);
  // Infinite scroll state for Top Stories.
  // - topStoriesPage: 1-based page index of the *next* page to load
  // - topStoriesHasMore: false once the backend signals there's nothing left
  // - topStoriesLoadingMore: true while a "next page" fetch is in flight
  // - topStoriesScrollRef / topStoriesSentinelRef: hooks for IntersectionObserver
  const TOP_STORIES_LIMIT = 20;
  const MOBILE_STORIES_BATCH = 5;
  const [topStoriesPage, setTopStoriesPage] = useState(1);
  const [topStoriesHasMore, setTopStoriesHasMore] = useState(false);
  const [topStoriesLoadingMore, setTopStoriesLoadingMore] = useState(false);
  const [mobileStoriesShown, setMobileStoriesShown] = useState(MOBILE_STORIES_BATCH);
  const topStoriesScrollRef = useRef<HTMLDivElement | null>(null);
  const topStoriesSentinelRef = useRef<HTMLDivElement | null>(null);
  const feedPaginationScrollRef = useRef<HTMLDivElement | null>(null);
  const articlesListRef = useRef<HTMLDivElement | null>(null);

  // Personalised "Main Article" — fetched separately from /api/home/main-article.
  // For logged-in users, the backend pulls reading history from the database.
  // For anonymous users, we send the localStorage history along with the
  // request so personalisation works without an account.
  const [mainArticle, setMainArticle] = useState<MainArticle | null>(null);

  // "Latest News" feed — independently sortable via /api/home/feed.
  // Default sort = "recommended", except on the /latest route where the
  // navbar Latest button means "give me the newest articles".
  const [feedSort, setFeedSort] = useState<FeedSort>(
    isLatestRoute ? "latest" : "recommended"
  );

  // "From your follows" strip (U4) — a small horizontal row of latest articles
  // from creators the user has subscribed to. Empty list (and hidden UI) when
  // anonymous or has no follows.
  const [followsArticles, setFollowsArticles] = useState<
    {
      id: string;
      title: string;
      slug: string;
      excerpt: string | null;
      imageUrl: string | null;
      audioUrl?: string | null;
      audioStatus?: ArticleAudioStatus | string | null;
      publishedAt: string | null;
      category: { id: string; name: string; slug: string };
      user: { id: string; name: string; avatarUrl: string | null };
    }[]
  >([]);

  // When the user navigates between / and /latest via the navbar, reset the
  // sort to that route's default. Manual sort changes after that are kept.
  useEffect(() => {
    setFeedSort(isLatestRoute ? "latest" : "recommended");
    setFeedPage(1);
  }, [isLatestRoute]);
  const [feedArticles, setFeedArticles] = useState<FeedArticle[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedTotalPages, setFeedTotalPages] = useState(1);
  const [feedPage, setFeedPage] = useState(1);
  const [homeTopDevice, setHomeTopDevice] = useState<"mobile" | "desktop">("desktop");
  const [activeDevicePlacements, setActiveDevicePlacements] = useState<Set<string>>(new Set());
  const timeZones = useMemo(() => getAllTimeZones(), []);
  const [timeZone, setTimeZone] = useState<string>(() => {
    const saved = localStorage.getItem("preferredTimeZone");
    return saved || getBrowserTimeZone();
  });
  const [clockText, setClockText] = useState(() => formatClock(new Date(), timeZone));

  useEffect(() => {
    if (!timeZones.includes(timeZone)) {
      const fallback = getBrowserTimeZone();
      setTimeZone(timeZones.includes(fallback) ? fallback : "UTC");
    }
  }, [timeZone, timeZones]);

  useEffect(() => {
    setClockText(formatClock(new Date(), timeZone));
    const timer = setInterval(() => {
      setClockText(formatClock(new Date(), timeZone));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeZone]);

  useEffect(() => {
    localStorage.setItem("preferredTimeZone", timeZone);
  }, [timeZone]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateDevice = () => {
      setHomeTopDevice(mediaQuery.matches ? "mobile" : "desktop");
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

    api
      .get("/config/adsense", { params: { device: homeTopDevice } })
      .then((res) => {
        if (cancelled) return;
        const ads = Array.isArray(res.data?.ads) ? (res.data.ads as AdConfig[]) : [];
        const preferredTarget = homeTopDevice === "mobile" ? "MOBILE" : "DESKTOP";
        const placements = new Set<string>();

        for (const ad of ads) {
          if (!ad?.placement || ad.isActive === false) continue;
          if (ad.deviceTarget === preferredTarget || ad.deviceTarget === "ALL") {
            placements.add(ad.placement);
          }
        }

        setActiveDevicePlacements(placements);
      })
      .catch(() => {
        if (!cancelled) setActiveDevicePlacements(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [homeTopDevice]);

  const hasPlacementAd = (placement: string): boolean =>
    activeDevicePlacements.has(placement);
  const hasHomeTopAd = hasPlacementAd("home-top");

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "18" };
    if (search) params.search = search;

    Promise.all([api.get("/articles", { params }), api.get("/categories")])
      .then(([articlesRes, categoriesRes]) => {
        setArticles(articlesRes.data.articles);
        setTotalPages(articlesRes.data.totalPages);
        setCategories(categoriesRes.data.categories);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  // Initial load (and reload when the sort tab changes). Resets the list,
  // pagination and scroll position back to page 1.
  useEffect(() => {
    setTopStoriesLoading(true);
    setTopStoriesError(null);
    setTopStories([]);
    setTopStoriesPage(1);
    setTopStoriesHasMore(false);

    api
      .get("/stories", {
        params: { sort: selectedStorySort, page: 1, limit: TOP_STORIES_LIMIT },
      })
      .then((res) => {
        const nextStories = Array.isArray(res.data?.articles)
          ? (res.data.articles as TopStoryArticle[])
          : [];
        setTopStories(nextStories);
        setTopStoriesHasMore(Boolean(res.data?.hasMore));
        setTopStoriesPage(2); // next page to fetch is 2
        // Scroll the inner list back to the top whenever the sort changes.
        if (topStoriesScrollRef.current) topStoriesScrollRef.current.scrollTop = 0;
      })
      .catch((err) => {
        console.error(err);
        setTopStories([]);
        setTopStoriesError("Failed to load top stories.");
      })
      .finally(() => setTopStoriesLoading(false));
  }, [selectedStorySort]);

  // Fetch the next page of Top Stories. Shared between desktop's
  // IntersectionObserver-driven auto-load and the mobile "Show more" button.
  const loadMoreTopStories = () => {
    if (topStoriesLoadingMore || !topStoriesHasMore) return;
    setTopStoriesLoadingMore(true);
    api
      .get("/stories", {
        params: {
          sort: selectedStorySort,
          page: topStoriesPage,
          limit: TOP_STORIES_LIMIT,
        },
      })
      .then((res) => {
        const more = Array.isArray(res.data?.articles)
          ? (res.data.articles as TopStoryArticle[])
          : [];
        // De-dup defensively in case the same article appears twice (e.g.
        // another article was published between two requests and shifted the
        // page boundary).
        setTopStories((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...more.filter((a) => !seen.has(a.id))];
        });
        setTopStoriesHasMore(Boolean(res.data?.hasMore));
        setTopStoriesPage((p) => p + 1);
      })
      .catch((err) => {
        console.error("top stories load-more failed", err);
        // Fail soft.
      })
      .finally(() => setTopStoriesLoadingMore(false));
  };

  // Auto-load when the bottom sentinel scrolls into view *inside the
  // scrollable container*. On mobile the inner container has no max-height
  // (see Tailwind classes below) so the sentinel never enters its viewport
  // — the page scrolls past freely instead, and users tap the explicit
  // "Show more" button when they want extra items. This avoids the mobile
  // "scroll-jail" anti-pattern where a nested scroller traps touch input
  // and keeps fetching while the user tries to scroll the page itself.
  useEffect(() => {
    if (topStoriesLoading) return;
    if (!topStoriesHasMore) return;
    const root = topStoriesScrollRef.current;
    const sentinel = topStoriesSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreTopStories();
      },
      { root, rootMargin: "120px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    topStoriesLoading,
    topStoriesHasMore,
    topStoriesLoadingMore,
    topStoriesPage,
    selectedStorySort,
  ]);

  // Fetch the "From your follows" strip (U4). Anonymous users get an empty
  // list back from the server, which keeps the JSX simple.
  useEffect(() => {
    if (!user) {
      setFollowsArticles([]);
      return;
    }
    api
      .get("/home/from-your-follows")
      .then((res) =>
        setFollowsArticles(Array.isArray(res.data?.articles) ? res.data.articles : [])
      )
      .catch(() => setFollowsArticles([]));
  }, [user]);

  // Fetch the personalised Main Article. Logged-in users get DB-backed
  // history; anonymous users send their localStorage payload (validated
  // server-side). On any failure we silently fall back to articles[0].
  // Skipped while the user is in search mode OR on /latest (which always
  // wants the newest article, not a personalised pick).
  useEffect(() => {
    if (search || isLatestRoute) {
      setMainArticle(null);
      return;
    }
    const body = user ? {} : getReadingHistoryPayload();
    api
      .post("/home/main-article", body)
      .then((res) => {
        setMainArticle(res.data?.article ?? null);
      })
      .catch((err) => {
        console.error("main-article fetch failed", err);
        setMainArticle(null);
      });
  }, [user, search, isLatestRoute]);

  // Lead article: personalised if available, otherwise the most recent article
  // from the regular feed (current behaviour preserved as fallback).
  const fallbackLead = articles[0] || null;
  const leadArticle: Article | MainArticle | null =
    mainArticle ?? fallbackLead;
  const leadId = leadArticle && "id" in leadArticle ? leadArticle.id : null;

  // Fetch the sortable "Latest News" feed. Disabled while the user is
  // searching — search uses the existing /articles endpoint instead.
  useEffect(() => {
    if (search) return;
    setFeedLoading(true);
    const body: Record<string, unknown> = {
      sort: feedSort,
      page: feedPage,
      limit: 18,
    };
    if (!user && feedSort === "recommended") {
      // Send anonymous reading history so the recommendation can personalise
      // without an account. Logged-in users get DB history server-side.
      const payload = getReadingHistoryPayload();
      body.readArticleIds = payload.readArticleIds;
      body.reads = payload.reads;
    }
    api
      .post("/home/feed", body)
      .then((res) => {
        const list: FeedArticle[] = Array.isArray(res.data?.articles)
          ? res.data.articles
          : [];
        setFeedArticles(list);
        setFeedTotalPages(res.data?.totalPages ?? 1);
      })
      .catch((err) => {
        console.error("feed fetch failed", err);
        setFeedArticles([]);
        setFeedTotalPages(1);
      })
      .finally(() => setFeedLoading(false));
  }, [feedSort, feedPage, user, search]);

  // The Latest News list always excludes the lead article (which sits above
  // it as the hero card). When the user is searching, we keep the existing
  // /articles search flow; otherwise we use the sortable /home/feed list.
  // FeedArticle is remapped into the shape the existing card JSX expects.
  const latestArticles: Article[] = search
    ? articles.filter((a) => a.id !== leadId).slice(4)
    : (leadId ? feedArticles.filter((a) => a.id !== leadId) : feedArticles).map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        authorName: a.authorName,
        imageUrl: a.imageUrl,
        audioUrl: a.audioUrl,
        audioStatus: a.audioStatus,
        publishedAt: a.publishedAt,
        category: { name: a.category.name, slug: a.category.slug },
        rating: { average: a.averageRating, count: a.ratingCount },
        views: { totalViews: a.views },
      }));

  const scrollToFeedPaginationTop = () => {
    if (typeof window === "undefined") return;

    const target = feedPaginationScrollRef.current ?? articlesListRef.current;
    if (!target) return;

    const top = window.scrollY + target.getBoundingClientRect().top - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const changeFeedPage = (nextPage: number) => {
    if (search) {
      setPage(nextPage);
    } else {
      setFeedPage(nextPage);
    }

    window.setTimeout(scrollToFeedPaginationTop, 100);
  };

  return (
    <>
      <SEOHead
        title={search ? `Search: ${search}` : "Worldwide Tech Journal"}
        description="Latest worldwide technology news covering AI, robotics, cybersecurity, blockchain, cloud computing, and more."
        path="/"
      />
      {/* L6: RSS alternate link for feed readers and search engine discovery */}
      <Helmet>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Ultimate Computer Software RSS Feed"
          href="/rss/category/artificial-intelligence.xml"
        />
      </Helmet>

      <main className="bg-[#f6f6f4] text-[#111111] min-h-screen">
        <section className="bg-white border-y border-black/90">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#262626]">
              Worldwide Tech Journal Desk
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-semibold tracking-[0.04em] text-neutral-700 whitespace-nowrap">
                {clockText}
              </span>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="text-[11px] border border-black/25 bg-white px-2 py-1 text-neutral-700 w-auto"
                style={{ width: "fit-content" }}
                aria-label="Select time zone"
                title="Select time zone"
              >
                {timeZones.map((zone) => (
                  <option key={zone} value={zone} title={zone}>
                    {formatTimeZoneShortLabel(zone)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white border-b border-black/15">
          <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
            {hasHomeTopAd ? (
              <div className="flex justify-center">
                <div
                  className="w-full max-w-[970px] h-[90px] flex items-center justify-center overflow-hidden"
                  aria-label="Homepage top banner"
                >
                  <AdBanner
                    placement="home-top"
                    variant="flat"
                    className="w-full h-full flex items-center justify-center"
                  />
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight [font-family:Georgia,'Times_New_Roman',serif] whitespace-nowrap">
                  Tech Journal
                </h1>
                <p className="mt-3 text-sm text-neutral-600 max-w-2xl">
                  {search
                    ? `Search results for "${search}"`
                    : "Global reporting on software, AI, enterprise systems, and digital innovation."}
                </p>
              </div>
            )}

            {hasHomeTopAd && search && (
              <p className="mt-4 text-sm text-neutral-600 max-w-2xl">
                Search results for "{search}"
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <Link
                to="/categories"
                className="inline-flex items-center text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-[#111111] hover:text-[#b5121b]"
              >
                Browse all categories
              </Link>
            </div>

            <div className="mt-6 hidden lg:flex flex-wrap justify-between gap-y-2">
              {categories.slice(0, 14).map((cat) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className="px-3 py-1.5 border border-black/20 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-[#262626] hover:bg-black hover:text-white transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* K3: AMA banner — shown only when there are active AMA threads */}
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <AmaBanner />
        </div>

        <section className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-black/20 border-t-black" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-24 text-neutral-500">
              <p className="text-lg">
                {search ? "No articles found for your search." : "No articles published yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-10">
                {leadArticle && (
                  <article className="lg:col-span-8">
                    {leadArticle.imageUrl && (
                      <Link to={`/${leadArticle.slug}`} className="relative block mb-5 overflow-hidden rounded-lg max-w-4xl">
                        {hasReadyAudio(leadArticle) && <ArticleListenBadge />}
                        <img
                          src={getImageUrl(leadArticle.imageUrl) || leadArticle.imageUrl}
                          alt={leadArticle.title}
                          className="w-full object-cover hover:opacity-90 transition-opacity"
                          style={{ aspectRatio: "16/9" }}
                          fetchPriority="high"
                          loading="eager"
                        />
                      </Link>
                    )}
                    <Link
                      to={`/category/${leadArticle.category.slug}`}
                      className="inline-block text-xs font-bold uppercase tracking-[0.14em] text-[#b5121b]"
                    >
                      {leadArticle.category.name}
                    </Link>

                    <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl leading-[1.1] font-bold [font-family:Georgia,'Times_New_Roman',serif]">
                      <Link to={`/${leadArticle.slug}`} className="hover:text-[#b5121b] transition-colors">
                        {leadArticle.title}
                      </Link>
                    </h2>

                    {cleanExcerptText(leadArticle.excerpt) && (
                      <p className="mt-5 text-base sm:text-lg text-neutral-700 leading-relaxed max-w-3xl">
                        {cleanExcerptText(leadArticle.excerpt)}
                      </p>
                    )}

                    <div className="mt-6 text-sm text-neutral-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium text-neutral-900">By {leadArticle.authorName}</span>
                      {leadArticle.publishedAt && (
                        <time dateTime={leadArticle.publishedAt}>• {formatArticleDate(leadArticle.publishedAt)}</time>
                      )}
                    </div>
                  </article>
                )}

                <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-black/15 pt-6 lg:pt-0 lg:pl-6">
                  <div className="flex flex-col gap-3 mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                      Top Stories
                    </h3>
                    <label className="flex items-center gap-2 text-xs text-neutral-600 uppercase tracking-[0.08em]">
                      Sort
                      <select
                        value={selectedStorySort}
                        onChange={(e) => setSelectedStorySort(e.target.value as StorySort)}
                        className="text-xs border border-black/25 bg-white px-2 py-1"
                      >
                        {STORY_SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {topStoriesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-black/20 border-t-black" />
                    </div>
                  ) : topStoriesError ? (
                    <p className="text-sm text-red-600 py-4">{topStoriesError}</p>
                  ) : topStories.length === 0 ? (
                    <p className="text-sm text-neutral-500 py-4">No top stories available right now.</p>
                  ) : (
                    <>
                    <div
                      ref={topStoriesScrollRef}
                      // Inner scroll container is desktop-only. On mobile we
                      // intentionally drop both `max-h-...` and `overflow-y-auto`
                      // so the list flows in the page and the user can scroll
                      // past it; otherwise touch gets trapped in this nested
                      // scroller while infinite-scroll keeps fetching.
                      className="space-y-4 lg:max-h-[720px] lg:overflow-y-auto lg:pr-1"
                    >
                      {topStories.slice(0, typeof window !== "undefined" && window.innerWidth >= 1024 ? topStories.length : mobileStoriesShown).map((article, index) => (
                        <article key={article.id} className="border-b border-black/10 pb-4 last:border-b-0 last:pb-0">
                          <div className="flex gap-3">
                            {article.imageUrl && (
                              <Link
                                to={`/${article.slug}`}
                                className="relative shrink-0 block w-28 sm:w-40 aspect-video overflow-hidden rounded"
                              >
                                {hasReadyAudio(article) && <ArticleListenBadge size="sm" />}
                                <img
                                  src={getImageUrl(article.imageUrl) || article.imageUrl}
                                  alt={article.title}
                                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                />
                              </Link>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <p className="text-xs font-bold text-neutral-500">
                                  {String(index + 1).padStart(2, "0")}
                                </p>
                                <div className="flex items-center gap-1">
                                  <Stars value={article.averageRating} size={11} />
                                  <span className="text-xs font-semibold text-neutral-700">
                                    {article.averageRating.toFixed(1)} ({article.ratingCount})
                                  </span>
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {article.views.toLocaleString()} reads
                                </div>
                              </div>

                              <h4 className="text-base leading-snug font-semibold [font-family:Georgia,'Times_New_Roman',serif]">
                                <Link to={`/${article.slug}`} className="hover:text-[#b5121b] transition-colors line-clamp-2">
                                  {article.title}
                                </Link>
                              </h4>

                              <p className="mt-2 text-xs text-neutral-500 uppercase tracking-[0.08em]">
                                {article.category.name}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}

                      {/* Desktop-only auto-load sentinel. `hidden lg:block`
                          keeps the IntersectionObserver from ever firing on
                          mobile (the element has no layout there). */}
                      {topStoriesHasMore && (
                        <div
                          ref={topStoriesSentinelRef}
                          aria-hidden="true"
                          className="hidden lg:block h-px"
                        />
                      )}

                      {topStoriesLoadingMore && (
                        <div className="flex justify-center py-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                        </div>
                      )}

                      {/* Mobile/tablet — Load next 5 button. Hidden on
                          lg+ where auto-load via the sentinel takes over. */}
                      {mobileStoriesShown < topStories.length && (
                        <button
                          type="button"
                          onClick={() => setMobileStoriesShown((prev) => Math.min(prev + MOBILE_STORIES_BATCH, topStories.length))}
                          className="lg:hidden w-full mt-4 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] border border-black/30 hover:bg-black hover:text-white transition-colors"
                        >
                          Load next 5
                        </button>
                      )}

                      {!topStoriesHasMore && topStories.length > TOP_STORIES_LIMIT && (
                        <p className="text-center text-xs text-neutral-400 py-3">
                          You've reached the end.
                        </p>
                      )}
                    </div>
                    </>
                  )}
                </aside>
              </div>

              {/* Tech Hub Cities — Infinite auto-scroll marquee */}
              <section className="hidden lg:flex lg:items-center pb-0 border-t border-black/15 overflow-hidden min-h-[56px]">
                <style>{`
                  @keyframes scroll-left {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                  .marquee-container {
                    animation: scroll-left 40s linear infinite;
                  }
                  .marquee-container:hover {
                    animation-play-state: paused;
                  }
                `}</style>
                <div className="marquee-container flex items-center gap-8 whitespace-nowrap text-sm text-neutral-600">
                  {[
                    "San Francisco",
                    "London",
                    "Tokyo",
                    "Berlin",
                    "Singapore",
                    "Toronto",
                    "Beijing",
                    "Seoul",
                    "Austin",
                    "Amsterdam",
                    "Tel Aviv",
                    "Sydney",
                    "Vancouver",
                    "Stockholm",
                    "Bangalore",
                    "Dubai",
                    "Mumbai",
                    "Hong Kong",
                    "São Paulo",
                    "Shanghai"
                  ].map((city, idx) => (
                    <span key={idx} className="shrink-0">
                      {city}
                    </span>
                  ))}
                  {/* Duplicate for infinite loop */}
                  {[
                    "San Francisco",
                    "London",
                    "Tokyo",
                    "Berlin",
                    "Singapore",
                    "Toronto",
                    "Beijing",
                    "Seoul",
                    "Austin",
                    "Amsterdam",
                    "Tel Aviv",
                    "Sydney",
                    "Vancouver",
                    "Stockholm",
                    "Bangalore",
                    "Dubai",
                    "Mumbai",
                    "Hong Kong",
                    "São Paulo",
                    "Shanghai"
                  ].map((city, idx) => (
                    <span key={`dup-${idx}`} className="shrink-0">
                      {city}
                    </span>
                  ))}
                </div>
              </section>

              {/* U4 — From your follows / For you / Latest strip.
                  Always visible (except in search mode) so every visitor sees
                  curated content above the fold.
                  - Logged in + has follows  → "From your follows" (follow-cards)
                  - Logged in + no follows   → "For you" (latest feed)
                  - Not logged in            → "Latest" (latest feed) */}
              {!search && latestArticles.length > 0 && (
                <section className="pt-8 border-t border-black/15">
                  <h3 className="text-xl sm:text-2xl font-bold mb-4 [font-family:Georgia,'Times_New_Roman',serif]">
                    {followsArticles.length > 0
                      ? "From your follows"
                      : user
                      ? "For you"
                      : "Latest"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {followsArticles.length > 0
                      ? followsArticles.slice(0, 3).map((a) => (
                          <article key={a.id} className="bg-white border border-black/15 p-3 flex gap-3">
                            {a.imageUrl && (
                              <Link
                                to={`/${a.slug}`}
                                className="relative shrink-0 w-28 aspect-video overflow-hidden rounded"
                              >
                                {hasReadyAudio(a) && <ArticleListenBadge size="sm" />}
                                <img
                                  src={getImageUrl(a.imageUrl) || a.imageUrl}
                                  alt={a.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </Link>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CreatorAvatar
                                  name={a.user.name}
                                  avatarUrl={a.user.avatarUrl}
                                  size={20}
                                />
                                <Link
                                  to={`/author/${a.user.id}`}
                                  className="text-xs font-semibold text-neutral-700 hover:text-[#b5121b] truncate"
                                >
                                  {a.user.name}
                                </Link>
                              </div>
                              <h4 className="text-sm font-semibold leading-snug line-clamp-2 [font-family:Georgia,'Times_New_Roman',serif]">
                                <Link to={`/${a.slug}`} className="hover:text-[#b5121b]">
                                  {a.title}
                                </Link>
                              </h4>
                            </div>
                          </article>
                        ))
                      : latestArticles.slice(0, 3).map((a) => (
                          <article key={a.id} className="bg-white border border-black/15 p-3 flex gap-3">
                            {a.imageUrl && (
                              <Link
                                to={`/${a.slug}`}
                                className="relative shrink-0 w-28 aspect-video overflow-hidden rounded"
                              >
                                {hasReadyAudio(a) && <ArticleListenBadge size="sm" />}
                                <img
                                  src={getImageUrl(a.imageUrl) || a.imageUrl}
                                  alt={a.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </Link>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-neutral-600 truncate mb-1">
                                {a.authorName}
                              </p>
                              <h4 className="text-sm font-semibold leading-snug line-clamp-2 [font-family:Georgia,'Times_New_Roman',serif]">
                                <Link to={`/${a.slug}`} className="hover:text-[#b5121b]">
                                  {a.title}
                                </Link>
                              </h4>
                            </div>
                          </article>
                        ))
                    }
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
                    {followsArticles.length > 0
                      ? followsArticles.slice(3, 6).map((a) => (
                          <article key={a.id} className="bg-white border border-black/15 p-3 flex gap-3">
                            {a.imageUrl && (
                              <Link
                                to={`/${a.slug}`}
                                className="relative shrink-0 w-28 aspect-video overflow-hidden rounded"
                              >
                                {hasReadyAudio(a) && <ArticleListenBadge size="sm" />}
                                <img
                                  src={getImageUrl(a.imageUrl) || a.imageUrl}
                                  alt={a.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </Link>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CreatorAvatar
                                  name={a.user.name}
                                  avatarUrl={a.user.avatarUrl}
                                  size={20}
                                />
                                <Link
                                  to={`/author/${a.user.id}`}
                                  className="text-xs font-semibold text-neutral-700 hover:text-[#b5121b] truncate"
                                >
                                  {a.user.name}
                                </Link>
                              </div>
                              <h4 className="text-sm font-semibold leading-snug line-clamp-2 [font-family:Georgia,'Times_New_Roman',serif]">
                                <Link to={`/${a.slug}`} className="hover:text-[#b5121b]">
                                  {a.title}
                                </Link>
                              </h4>
                            </div>
                          </article>
                        ))
                      : latestArticles.slice(3, 6).map((a) => (
                          <article key={a.id} className="bg-white border border-black/15 p-3 flex gap-3">
                            {a.imageUrl && (
                              <Link
                                to={`/${a.slug}`}
                                className="relative shrink-0 w-28 aspect-video overflow-hidden rounded"
                              >
                                {hasReadyAudio(a) && <ArticleListenBadge size="sm" />}
                                <img
                                  src={getImageUrl(a.imageUrl) || a.imageUrl}
                                  alt={a.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </Link>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-neutral-600 truncate mb-1">
                                {a.authorName}
                              </p>
                              <h4 className="text-sm font-semibold leading-snug line-clamp-2 [font-family:Georgia,'Times_New_Roman',serif]">
                                <Link to={`/${a.slug}`} className="hover:text-[#b5121b]">
                                  {a.title}
                                </Link>
                              </h4>
                            </div>
                          </article>
                        ))
                    }
                  </div>
                </section>
              )}

              <div ref={feedPaginationScrollRef} className="h-0" aria-hidden="true" />

              {/* Homepage-1: directly under From your follows / For you block */}
              {!search && latestArticles.length > 0 && hasPlacementAd("homepage_1") && (
                <AdBanner
                  placement="homepage_1"
                  variant="flat"
                  className="mt-6 mx-auto w-[300px] max-w-full h-[250px] lg:w-full lg:max-w-[970px] lg:h-[90px] flex items-center justify-center overflow-hidden"
                />
              )}

              {(latestArticles.length > 0 || (!search && feedLoading)) && (
                <section className="pt-10">
                  <div ref={articlesListRef} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                    <h3 className="text-2xl sm:text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
                      {search
                        ? "More Results"
                        : FEED_SORT_OPTIONS.find((o) => o.value === feedSort)?.label ??
                          "Latest News"}
                    </h3>
                    {!search && (
                      <FeedSortBar
                        value={feedSort}
                        onChange={(next) => {
                          setFeedSort(next);
                          setFeedPage(1);
                        }}
                      />
                    )}
                  </div>

                  {!search && feedLoading && latestArticles.length === 0 && (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-black/20 border-t-black" />
                    </div>
                  )}

                  {/*
                    Homepage in-feed slots:
                    - Homepage-2 after first row
                    - Homepage-3 after the next three rows
                    - Homepage-4 after another three rows
                    If there are not enough cards for later insertion points,
                    render missing slots at the end of the list.
                  */}
                  {(() => {
                    const feedSlots: Array<{
                      afterIndex: number;
                      placement: "homepage_2" | "homepage_3" | "homepage_4";
                    }> = [
                      { afterIndex: 1, placement: "homepage_2" },
                      { afterIndex: 7, placement: "homepage_3" },
                      { afterIndex: 13, placement: "homepage_4" },
                    ];

                    const renderHomepageFeedAd = (
                      placement: "homepage_2" | "homepage_3" | "homepage_4",
                      key: string
                    ) =>
                      hasPlacementAd(placement) ? (
                      <div key={key} className="md:col-span-2 mt-6 mb-6">
                        <div className="flex items-center justify-center w-full py-5">
                          <div
                            className="flex items-center justify-center overflow-hidden"
                            style={{ width: "970px", maxWidth: "100%", minHeight: "250px" }}
                          >
                            <AdBanner
                              placement={placement}
                              variant="flat"
                              className="w-full h-full flex items-center justify-center"
                            />
                          </div>
                        </div>
                      </div>
                      ) : null;

                    return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                    {latestArticles.map((article, index) => (
                      <Fragment key={article.id}>
                        <article className="py-5 border-t border-black/15">
                          {article.imageUrl && (
                            <Link
                              to={`/${article.slug}`}
                              className="relative block mb-4 overflow-hidden rounded-lg"
                              style={{ aspectRatio: "16/9" }}
                            >
                              {hasReadyAudio(article) && <ArticleListenBadge />}
                              <img
                                src={getImageUrl(article.imageUrl) || article.imageUrl}
                                alt={article.title}
                                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                                loading="lazy"
                              />
                            </Link>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.08em] mb-3">
                            <Link
                              to={`/category/${article.category.slug}`}
                              className="font-bold text-[#b5121b] hover:text-black"
                            >
                              {article.category.name}
                            </Link>
                            {article.publishedAt && (
                              <time dateTime={article.publishedAt} className="text-neutral-500">
                                {formatArticleDate(article.publishedAt)}
                              </time>
                            )}
                          </div>

                          <h4 className="text-xl leading-snug font-semibold [font-family:Georgia,'Times_New_Roman',serif]">
                            <Link to={`/${article.slug}`} className="hover:text-[#b5121b] transition-colors">
                              {article.title}
                            </Link>
                          </h4>

                          {cleanExcerptText(article.excerpt) && (
                            <p className="mt-3 text-sm text-neutral-700 line-clamp-3">
                              {cleanExcerptText(article.excerpt)}
                            </p>
                          )}

                          {(article.rating || article.views) && (
                            <div className="flex items-center gap-4 text-xs text-neutral-500 mt-3 pt-3 border-t border-black/10">
                              {article.rating && (
                                <div className="flex items-center gap-1">
                                  <Stars value={article.rating.average} size={14} />
                                  <span className="font-semibold text-neutral-700">
                                    {article.rating.average.toFixed(1)} ({article.rating.count})
                                  </span>
                                </div>
                              )}
                              {article.views && (
                                <div className="text-neutral-500">
                                  {article.views.totalViews.toLocaleString()} reads
                                </div>
                              )}
                            </div>
                          )}

                          <p className="mt-3 text-xs text-neutral-500">By {article.authorName}</p>
                        </article>

                        {!search &&
                          (() => {
                            const slot = feedSlots.find((s) => s.afterIndex === index);
                            return slot
                              ? renderHomepageFeedAd(
                                  slot.placement,
                                  `homepage-feed-ad-${slot.placement}-${index}`
                                )
                              : null;
                          })()}
                      </Fragment>
                    ))}
                    {!search &&
                      feedSlots
                        .filter((slot) => latestArticles.length <= slot.afterIndex)
                        .map((slot) =>
                          renderHomepageFeedAd(
                            slot.placement,
                            `homepage-feed-ad-end-${slot.placement}`
                          )
                        )}
                  </div>
                    );
                  })()}
                </section>
              )}

              {/* In search mode the pagination drives the /articles call; in
                  the default Latest News view it drives the sortable /home/feed. */}
              {(() => {
                const tp = search ? totalPages : feedTotalPages;
                const cp = search ? page : feedPage;
                if (tp <= 1) return null;
                return (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => changeFeedPage(Math.max(1, cp - 1))}
                      disabled={cp === 1}
                      className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-neutral-600">
                      Page {cp} of {tp}
                    </span>
                    <button
                      onClick={() => changeFeedPage(Math.min(tp, cp + 1))}
                      disabled={cp === tp}
                      className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
                    >
                      Next
                    </button>
                  </div>
                );
              })()}
            </>
          )}
        </section>
      </main>
    </>
  );
}
