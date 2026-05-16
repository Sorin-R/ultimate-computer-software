import { memo, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import ArticleCard from "../../components/ArticleCard";
import ArticleListenBadge from "../../components/ArticleListenBadge";
import ArticleAudioPlayer from "../../components/ArticleAudioPlayer";
import AdBanner from "../../components/AdBanner";
import ArticleReviews from "../../components/ArticleReviews";
import ArticleComments from "../../components/ArticleComments";
import FollowButton from "../../components/FollowButton";
import BookmarkButton from "../../components/BookmarkButton";
import ArticleReactions from "../../components/ArticleReactions";
import { QuoteShareWrapper } from "../../components/QuoteShare";
import { Stars } from "../../components/Stars";
import { cleanExcerptText } from "../../utils/contentText";
import { hasReadyAudio } from "../../utils/articleAudio";
import { getImageUrl } from "../../utils/imageUrl";
import { recordArticleRead } from "../../utils/readingHistory";
import TagFollowButton from "../../components/TagFollowButton";
import PollWidget from "../../components/PollWidget";
import ReportModal from "../../components/ReportModal";
import { useAuth } from "../../context/AuthContext";
import { absoluteSiteUrl } from "../../utils/site";

interface Article {
  id: string;
  title: string;
  slug: string;
  status?: string;
  body: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioStatus: "NONE" | "PROCESSING" | "READY" | "FAILED";
  audioGeneratedAt?: string | null;
  createdAt?: string | null;
  publishedAt: string | null;
  updatedAt?: string;
  userId: string;
  articleType: "ARTICLE" | "AMA" | "DISCUSSION";
  amaExpiresAt: string | null;
  category: { id: string; name: string; slug: string };
  tags: { tag: { id: string; name: string; slug: string } }[];
  user: { name: string; username?: string | null; isVerified?: boolean };
  rating: { average: number; count: number };
  views?: { totalViews: number; uniqueViews: number };
  isFollowingAuthor?: boolean;
  originalSourceUrl?: string | null;
  reviewChanges?: SubmittedArticleReviewChanges | null;
}

interface SubmittedArticleReviewChange {
  field: string;
  before: string | null;
  after: string | null;
  note?: string | null;
}

interface SubmittedArticleReviewChanges {
  baseVersion: number;
  baseCreatedAt: string;
  submittedVersion: number | null;
  submittedCreatedAt: string | null;
  changes: SubmittedArticleReviewChange[];
}

interface PollOption {
  id: string;
  text: string;
  position: number;
  votes: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  endsAt: string | null;
  isExpired: boolean;
  totalVotes: number;
  myVoteOptionId: string | null;
  options: PollOption[];
}

interface RelatedArticle {
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: string | null;
  publishedAt: string | null;
  category?: { name: string; slug: string };
  rating?: { average: number; count: number };
  views?: { totalViews: number; uniqueViews?: number };
}

const YOUTUBE_EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

const CODESANDBOX_ALLOW =
  "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking";

/** Allowed iframe origins — mirrors the backend sanitize.ts whitelist. */
const ALLOWED_IFRAME_HOSTS: RegExp[] = [
  /^(www\.)?youtube\.com$/,
  /^youtu\.be$/,
  /^(www\.)?youtube-nocookie\.com$/,
  /^codesandbox\.io$/,
  /^stackblitz\.com$/,
  /^codepen\.io$/,
  /^jsfiddle\.net$/,
  /^replit\.com$/,
  /mastodon\./,
];

function isAllowedIframeHost(src: string): boolean {
  try {
    const { hostname } = new URL(src);
    return ALLOWED_IFRAME_HOSTS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

function isCodeSandboxHost(hostname: string): boolean {
  return hostname.endsWith("codesandbox.io");
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

function getEstimatedReadTime(html: string): number {
  const plainText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!plainText) return 1;
  const words = plainText.split(" ").length;
  return Math.max(1, Math.round(words / 220));
}

function formatPublishedDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPreviewDateTime(date: string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isArticleUpdated(publishedAt: string | null, updatedAt: string | null): boolean {
  if (!publishedAt || !updatedAt) return false;
  return new Date(updatedAt) > new Date(publishedAt);
}

function formatTimeSpent(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function parseTimeToSeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function toYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    let videoId: string | null = null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      videoId = path.replace(/^\/+/, "").split("/")[0] || null;
    } else if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com" ||
      host === "www.youtube-nocookie.com"
    ) {
      if (path.startsWith("/embed/")) {
        videoId = path.replace("/embed/", "").split("/")[0] || null;
      } else if (path.startsWith("/shorts/")) {
        videoId = path.replace("/shorts/", "").split("/")[0] || null;
      } else if (path.startsWith("/watch")) {
        videoId = parsed.searchParams.get("v");
      }
    }

    if (!videoId) return null;

    const startRaw = parsed.searchParams.get("start") || parsed.searchParams.get("t");
    const startSeconds = parseTimeToSeconds(startRaw);
    const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
    if (startSeconds) embed.searchParams.set("start", String(startSeconds));
    return embed.toString();
  } catch {
    return null;
  }
}

function sanitizeArticleBody(html: string, fallbackAlt = "Article image"): string {
  // Replace non-breaking spaces with regular spaces so text wraps correctly.
  // Rich text editors often paste content with U+00A0 between every word,
  // which prevents line breaks at word boundaries.
  const normalized = html
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ");

  const sanitized = DOMPurify.sanitize(normalized, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "referrerpolicy", "loading", "title"],
  });

  const parser = new DOMParser();
  const document = parser.parseFromString(`<body>${sanitized}</body>`, "text/html");

  // Transform relative image URLs to absolute URLs pointing to the backend and wrap in 16:9 container
  document.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("/uploads/")) {
      const absoluteUrl = getImageUrl(src);
      if (absoluteUrl) {
        img.setAttribute("src", absoluteUrl);
      }
    }
    // C2: Explicit dimensions reserve layout space before the image loads → prevents CLS.
    img.setAttribute("width", "1280");
    img.setAttribute("height", "720");
    // M8: Ensure every body image has descriptive alt text for accessibility/SEO.
    if (!img.getAttribute("alt")) {
      img.setAttribute("alt", fallbackAlt);
    }
    img.setAttribute("loading", "lazy");
    img.setAttribute("style", "width: 100%; height: 100%; object-fit: cover;");

    // Wrap image in 16:9 aspect ratio container
    const wrapper = document.createElement("div");
    wrapper.className = "article-media";
    // Only lock the aspect-ratio inline so the box reserves vertical space
    // before the iframe loads. Width/margins/overflow come from the CSS class
    // (.article-body .article-media) which uses negative margins to break out
    // of the article card padding — overriding width here breaks centering.
    wrapper.setAttribute("style", "aspect-ratio: 16 / 9;");
    img.parentNode?.insertBefore(wrapper, img);
    wrapper.appendChild(img);
  });

  document.querySelectorAll("iframe").forEach((iframe) => {
    const src = iframe.getAttribute("src") || "";

    // Try YouTube first (normalises to embed URL)
    const ytUrl = toYouTubeEmbedUrl(src);
    if (ytUrl) {
      iframe.removeAttribute("width");
      iframe.removeAttribute("height");
      iframe.setAttribute("src", ytUrl);
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      iframe.setAttribute("allow", YOUTUBE_EMBED_ALLOW);
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("style", "width: 100%; height: 100%;");
    } else if (isAllowedIframeHost(src)) {
      // Other whitelisted hosts (CodeSandbox, StackBlitz, CodePen, etc.)
      let hostname = "";
      try { hostname = new URL(src).hostname; } catch { /* ignore */ }
      iframe.removeAttribute("width");
      iframe.removeAttribute("height");
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("style", "width: 100%; height: 100%;");
      if (isCodeSandboxHost(hostname)) {
        iframe.setAttribute("allow", CODESANDBOX_ALLOW);
        iframe.setAttribute("sandbox", "allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts");
      } else {
        iframe.setAttribute("allow", YOUTUBE_EMBED_ALLOW);
      }
    } else {
      // Unknown host — strip for safety
      iframe.remove();
      return;
    }

    // Remove explicit width/height to let CSS handle proper sizing
    iframe.removeAttribute("width");
    iframe.removeAttribute("height");

    // Wrap iframe in 16:9 aspect ratio container
    const wrapper = document.createElement("div");
    wrapper.className = "article-media";
    // Only lock the aspect-ratio inline so the box reserves vertical space
    // before the iframe loads. Width/margins/overflow come from the CSS class
    // (.article-body .article-media) which uses negative margins to break out
    // of the article card padding — overriding width here breaks centering.
    wrapper.setAttribute("style", "aspect-ratio: 16 / 9;");
    iframe.parentNode?.insertBefore(wrapper, iframe);
    wrapper.appendChild(iframe);
  });

  document.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    const safeEmbedUrl = toYouTubeEmbedUrl(href);
    if (!safeEmbedUrl) return;

    const anchorText = (anchor.textContent || "").trim();
    const looksLikeDirectVideoLink =
      anchorText.length === 0 ||
      anchorText === href ||
      anchorText.replace(/^https?:\/\//, "") === href.replace(/^https?:\/\//, "");

    if (!looksLikeDirectVideoLink) return;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", safeEmbedUrl);
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("allow", YOUTUBE_EMBED_ALLOW);
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("title", "YouTube video player");
    iframe.setAttribute("style", "width: 100%; height: 100%;");

    // Wrap iframe in 16:9 aspect ratio container
    const wrapper = document.createElement("div");
    wrapper.className = "article-media";
    // Only lock the aspect-ratio inline so the box reserves vertical space
    // before the iframe loads. Width/margins/overflow come from the CSS class
    // (.article-body .article-media) which uses negative margins to break out
    // of the article card padding — overriding width here breaks centering.
    wrapper.setAttribute("style", "aspect-ratio: 16 / 9;");
    wrapper.appendChild(iframe);
    anchor.replaceWith(wrapper);
  });

  return document.body.innerHTML;
}

function SubmittedChangesPanel({ changes }: { changes: SubmittedArticleReviewChanges }) {
  const baseDate = formatPreviewDateTime(changes.baseCreatedAt);
  const submittedDate = formatPreviewDateTime(changes.submittedCreatedAt);

  return (
    <section className="mb-6 max-w-4xl bg-white border border-amber-300 shadow-sm">
      <div className="px-4 py-3 border-b border-amber-200 bg-amber-50">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
          Submitted Changes
        </p>
        <p className="mt-1 text-sm text-amber-900">
          Compared with version {changes.baseVersion}
          {baseDate ? ` from ${baseDate}` : ""}
          {changes.submittedVersion && submittedDate
            ? ` to submitted version ${changes.submittedVersion} from ${submittedDate}`
            : ""}.
        </p>
      </div>

      <div className="divide-y divide-black/10">
        {changes.changes.map((change) => (
          <div key={change.field} className="grid gap-3 px-4 py-4 md:grid-cols-[8rem_minmax(0,1fr)]">
            <p className="text-sm font-semibold text-neutral-900">{change.field}</p>
            <div className="space-y-2 text-sm text-neutral-700">
              {change.note && (
                <p className="font-medium text-neutral-900">{change.note}</p>
              )}
              <div className="grid gap-2 lg:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                    Before
                  </p>
                  <p className="mt-1 break-words text-neutral-700">{change.before || "empty"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                    Submitted
                  </p>
                  <p className="mt-1 break-words text-neutral-900">{change.after || "empty"}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Renders the sanitized article HTML. Wrapped in React.memo so it only
// re-renders when `body` actually changes — NOT every time the parent
// (ArticlePage) re-renders for the time-spent counter. Without this,
// dangerouslySetInnerHTML re-set the innerHTML once per second, which
// destroyed and recreated the YouTube iframe inside, causing it to flash.
const ArticleBody = memo(function ArticleBody({ body, fallbackAlt }: { body: string; fallbackAlt: string }) {
  const sanitized = sanitizeArticleBody(body, fallbackAlt);
  const containerRef = useRef<HTMLDivElement>(null);

  // C4: Apply highlight.js to all code blocks after the HTML is injected.
  // Also attach a "Copy" button to each <pre> block.
  useEffect(() => {
    let cancelled = false;

    const applyHighlighting = async () => {
      if (!containerRef.current) return;
      const [{ default: hljs }] = await Promise.all([
        import("highlight.js"),
        import("highlight.js/styles/github-dark.min.css"),
      ]);
      if (cancelled || !containerRef.current) return;

      containerRef.current.querySelectorAll<HTMLPreElement>("pre").forEach((pre) => {
        const codeEl = pre.querySelector<HTMLElement>("code");
        if (!codeEl) return;

        // Syntax-highlight the block (skip if already done)
        if (!codeEl.classList.contains("hljs")) {
          hljs.highlightElement(codeEl);
        }

        // Attach a copy button (only once)
        if (pre.querySelector(".code-copy-btn")) return;
        const btn = document.createElement("button");
        btn.className = "code-copy-btn";
        btn.textContent = "Copy";
        btn.setAttribute("aria-label", "Copy code to clipboard");
        btn.addEventListener("click", () => {
          navigator.clipboard.writeText(codeEl.textContent || "").then(() => {
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = "Copy"; }, 2000);
          });
        });
        pre.appendChild(btn);
      });
    };

    applyHighlighting();

    return () => {
      cancelled = true;
    };
  }, [sanitized]);

  return (
    <div
      ref={containerRef}
      className="article-body mt-8 text-neutral-700 text-lg leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
});

export default function ArticlePage() {
  const MIN_SIDEBAR_ARTICLES = 8;
  const ARTICLES_PER_PAGE = 2;
  const { user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const articleColumnRef = useRef<HTMLElement | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<RelatedArticle[]>([]);
  const [fallbackNewest, setFallbackNewest] = useState<RelatedArticle[]>([]);
  const [sidebarMaxHeight, setSidebarMaxHeight] = useState<number | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [displayedArticlesCount, setDisplayedArticlesCount] = useState(ARTICLES_PER_PAGE);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 1024);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const loadArticle = async () => {
      setLoading(true);
      setNotFound(false);
      setArticle(null);
      setRelated([]);
      setFallbackNewest([]);
      // Reset the on-page timer so it starts fresh for every new article. The
      // ArticlePage component is reused across navigations (e.g. clicking a
      // Related Article link), so without this reset timeSpent would carry
      // over from the previous article.
      setTimeSpent(0);
      // Reset displayed articles based on screen size
      const mobile = typeof window !== "undefined" && window.innerWidth < 1024;
      setDisplayedArticlesCount(mobile ? ARTICLES_PER_PAGE : Number.MAX_SAFE_INTEGER);

      try {
        const res = await api.get(`/articles/${slug}`);
        if (cancelled) return;

        const fetched = res.data.article as Article;
        const initialRelated = ((res.data.related ?? []) as RelatedArticle[]).filter(
          (entry) => entry.slug !== fetched.slug
        );
        setArticle(fetched);

        let sidebarRelated = initialRelated;

        // Load a broader category list so the sidebar has enough entries.
        try {
          if (fetched?.category?.slug) {
            const byCategoryRes = await api.get("/articles", {
              params: { category: fetched.category.slug, page: 1, limit: 30 },
            });
            if (!cancelled) {
              const byCategory = ((byCategoryRes.data?.articles ?? []) as RelatedArticle[]).filter(
                (entry) => entry.slug !== fetched.slug
              );
              if (byCategory.length > 0) {
                sidebarRelated = byCategory;
              }
            }
          }
        } catch {
          // Keep existing related data from /articles/:slug as fallback.
        }

        if (cancelled) return;
        setRelated(sidebarRelated);

        // Always load fallback latest articles to show after same-category articles
        try {
          const newestRes = await api.get("/articles", {
            params: { page: 1, limit: 30 },
          });
          if (!cancelled) {
            const existingSlugs = new Set(sidebarRelated.map((entry) => entry.slug));
            const newest = ((newestRes.data?.articles ?? []) as RelatedArticle[]).filter(
              (entry) => entry.slug !== fetched.slug && !existingSlugs.has(entry.slug)
            );
            setFallbackNewest(newest);
          }
        } catch {
          if (!cancelled) setFallbackNewest([]);
        }

        // Track this read for anonymous personalisation.
        if (fetched?.id && fetched?.category?.id) {
          recordArticleRead(fetched.id, fetched.category.id);
        }

        // K10: Load polls for this article
        if (fetched?.id) {
          api.get(`/articles/${fetched.id}/polls`).then((r) => {
            if (!cancelled) setPolls(r.data.polls ?? []);
          }).catch(() => {});
        }
      } catch (err) {
        if (!cancelled && isNotFoundError(err)) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadArticle();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Track article views after 3 seconds — but only count time while the page
  // is actually visible. If the user switches to another tab/window or
  // minimises the browser, the timer pauses; it resumes when they come back.
  useEffect(() => {
    if (!slug) return;

    // Total ms accumulated while the page was visible.
    let accumulatedMs = 0;
    // Timestamp of the most recent "became visible" event. null when hidden.
    let activeStart: number | null =
      document.visibilityState === "visible" ? Date.now() : null;
    let hasRecorded = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const visibleSeconds = () => {
      const ongoing = activeStart != null ? Date.now() - activeStart : 0;
      return Math.floor((accumulatedMs + ongoing) / 1000);
    };

    // (Re)schedule the "record view" callback for `delayMs` of *visible* time.
    const scheduleRecord = (delayMs: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (hasRecorded) return;
        try {
          await api.post(`/articles/${slug}/views`, {
            timeSpentSeconds: visibleSeconds(),
          });
          hasRecorded = true;
        } catch (err) {
          console.error("Failed to record view", err);
        }
      }, delayMs);
    };

    // Initial arming — only if the page was visible when we mounted.
    if (activeStart != null) scheduleRecord(3000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Pause: bank the visible window and clear the pending record timer.
        if (activeStart != null) {
          accumulatedMs += Date.now() - activeStart;
          activeStart = null;
        }
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } else {
        // Resume: start a fresh visible window and re-arm the 3s record timer
        // for whatever visible time is still missing.
        activeStart = Date.now();
        if (!hasRecorded) {
          const remainingMs = Math.max(0, 3000 - accumulatedMs);
          scheduleRecord(remainingMs);
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    // Track when user leaves the page (only the *visible* time is reported).
    const handleBeforeUnload = () => {
      if (hasRecorded) return;
      const seconds = visibleSeconds();
      if (seconds >= 3) {
        navigator.sendBeacon(
          `/api/articles/${slug}/views`,
          JSON.stringify({ timeSpentSeconds: seconds })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [slug]);

  // Visible "time on page" counter — only ticks while the document is visible.
  // This is the value rendered to the user in the article header.
  useEffect(() => {
    if (!article) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval != null) return;
      interval = setInterval(() => setTimeSpent((prev) => prev + 1), 1000);
    };
    const stop = () => {
      if (interval != null) {
        clearInterval(interval);
        interval = null;
      }
    };

    if (document.visibilityState === "visible") start();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [article]);

  // Detect screen size changes and reset pagination on mobile/desktop transition
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Reset displayed articles count when switching between mobile and desktop
      if (mobile) {
        setDisplayedArticlesCount(ARTICLES_PER_PAGE);
      } else {
        // On desktop, show all related articles (constrained by sidebar max-height)
        setDisplayedArticlesCount(Number.MAX_SAFE_INTEGER);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keep the right sidebar from growing taller than the main article block
  // on desktop; overflow is handled by internal scrolling.
  useEffect(() => {
    if (!article) return;

    const syncSidebarHeight = () => {
      if (typeof window !== "undefined" && window.innerWidth >= 1024 && articleColumnRef.current) {
        setSidebarMaxHeight(articleColumnRef.current.offsetHeight);
      } else {
        setSidebarMaxHeight(null);
      }
    };

    syncSidebarHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && articleColumnRef.current
        ? new ResizeObserver(syncSidebarHeight)
        : null;
    if (resizeObserver && articleColumnRef.current) {
      resizeObserver.observe(articleColumnRef.current);
    }

    window.addEventListener("resize", syncSidebarHeight);

    return () => {
      window.removeEventListener("resize", syncSidebarHeight);
      resizeObserver?.disconnect();
    };
  }, [article, related.length, fallbackNewest.length]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Article Not Found</h1>
        <p className="text-neutral-600 mb-6">
          The article you are looking for does not exist or has not been published yet.
        </p>
        <Link to="/" className="text-[#b5121b] hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  const cleanExcerpt = cleanExcerptText(article.excerpt);
  const publicationDateSource = article.publishedAt ?? article.createdAt ?? null;
  const publishedDate = formatPublishedDate(publicationDateSource);
  const readTimeMinutes = getEstimatedReadTime(article.body);
  const articleUrl = absoluteSiteUrl(`/${article.slug}`);
  const audioSrc = article.audioUrl ? getImageUrl(article.audioUrl) || article.audioUrl : null;
  const showAudioReader = article.audioStatus === "READY" && Boolean(audioSrc);
  const showSubmittedChanges =
    article.status === "SUBMITTED" &&
    (user?.role === "ADMIN" || user?.role === "MODERATOR") &&
    Boolean(article.reviewChanges?.changes.length);
  const relatedForSidebar = related;
  const latestSupplement = fallbackNewest;
  const sidebarTotalCount = relatedForSidebar.length + latestSupplement.length;
  const visibleRelatedCount = Math.min(displayedArticlesCount, relatedForSidebar.length);
  const visibleLatestCount = Math.min(
    Math.max(0, displayedArticlesCount - visibleRelatedCount),
    latestSupplement.length
  );
  const visibleRelatedArticles = relatedForSidebar.slice(0, visibleRelatedCount);
  const visibleLatestArticles = latestSupplement.slice(0, visibleLatestCount);
  const combinedVisibleArticles = [...visibleRelatedArticles, ...visibleLatestArticles];
  const latestSectionStartIndex = visibleRelatedArticles.length;
  const sidebarHeading = relatedForSidebar.length > 0 ? "Related Articles" : "Latest Articles";
  const sidebarSubtitle =
    relatedForSidebar.length > 0 && latestSupplement.length > 0
      ? `Explore more from ${article.category.name}, then continue with latest stories.`
      : relatedForSidebar.length > 0
        ? `Explore more from the ${article.category.name} category`
        : "No related stories found yet. Here are the latest published articles.";
  // H1: word count for NewsArticle schema (strip HTML before counting)
  const wordCount = article.body
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: cleanExcerpt || undefined,
    image: article.imageUrl
      ? [getImageUrl(article.imageUrl) || (article.imageUrl.startsWith("http") ? article.imageUrl : absoluteSiteUrl(article.imageUrl))]
      : undefined,
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || article.publishedAt || undefined,
    // L8: dateCreated gives Google a creation date separate from publish date
    dateCreated: article.createdAt || article.publishedAt || undefined,
    // H1: Required by Google News for better rich result eligibility
    wordCount,
    isAccessibleForFree: true,
    inLanguage: "en",
    author: {
      "@type": "Person",
      name: article.authorName,
      url: absoluteSiteUrl(`/author/${article.user.username ?? article.userId}`),
    },
    publisher: {
      "@type": "Organization",
      name: "Ultimate Computer Software",
      url: absoluteSiteUrl("/"),
      logo: {
        // H2: Use raster PNG for Google Rich Results (SVG is not accepted)
        "@type": "ImageObject",
        url: absoluteSiteUrl("/logo-google.png"),
        width: 600,
        height: 60,
      },
    },
    mainEntityOfPage: articleUrl,
    articleSection: article.category.name,
    keywords: article.tags.map(({ tag }) => tag.name).join(", "),
    associatedMedia:
      article.audioStatus === "READY" && article.audioUrl
        ? {
            "@type": "AudioObject",
            contentUrl: absoluteSiteUrl(article.audioUrl),
            encodingFormat: "audio/mpeg",
          }
        : undefined,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteSiteUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: article.category.name,
        item: absoluteSiteUrl(`/category/${article.category.slug}`),
      },
      { "@type": "ListItem", position: 3, name: article.title, item: articleUrl },
    ],
  };

  const renderRelatedAdCard = (
    placement: "related_articles_1" | "related_articles_2" | "related_articles_3"
  ) => (
    <div className="bg-white border border-black/15 overflow-hidden hover:border-black/35 transition-colors flex flex-col h-full">
      <AdBanner placement={placement} variant="card" className="w-full h-full" />
    </div>
  );

  // M7: QAPage schema for AMA articles — only when the article type is AMA
  // and there are real top-level comments to use as answers.
  const qaPageSchema =
    article.articleType === "AMA" && (cleanExcerpt || article.title)
      ? {
          "@context": "https://schema.org",
          "@type": "QAPage",
          mainEntity: {
            "@type": "Question",
            name: article.title,
            text: cleanExcerpt || article.title,
            answerCount: 0, // updated client-side once comments load
            author: {
              "@type": "Person",
              name: article.authorName,
            },
          },
        }
      : null;

  return (
    <>
      <SEOHead
        title={article.title}
        description={cleanExcerpt || undefined}
        path={`/${article.slug}`}
        type="article"
        appendSiteName={false}
        imageUrl={absoluteSiteUrl(`/og/article/${article.slug}.png`)}
        imageAlt={article.title}
        author={article.authorName}
        publishedTime={article.publishedAt}
        modifiedTime={article.updatedAt || article.publishedAt}
        section={article.category.name}
        tags={article.tags.map(({ tag }) => tag.name)}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(newsArticleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {/* M7: QAPage schema for AMA articles only */}
        {qaPageSchema && (
          <script type="application/ld+json">{JSON.stringify(qaPageSchema)}</script>
        )}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${article.authorName} RSS Feed`}
          href={`/rss/author/${encodeURIComponent(article.user.username ?? article.userId)}.xml`}
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${article.category.name} RSS Feed`}
          href={`/rss/category/${encodeURIComponent(article.category.slug)}.xml`}
        />
        {article.tags.slice(0, 3).map(({ tag }) => (
          <link
            key={tag.id}
            rel="alternate"
            type="application/rss+xml"
            title={`${tag.name} RSS Feed`}
            href={`/rss/tag/${encodeURIComponent(tag.slug)}.xml`}
          />
        ))}
      </Helmet>

      <main className="bg-[#f6f6f4] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          {/* Breadcrumb and Actions Container */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-sm text-neutral-500 uppercase tracking-[0.08em]">
              <Link to="/" className="hover:text-[#b5121b] transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link to={`/category/${article.category.slug}`} className="hover:text-[#b5121b] transition-colors">
                {article.category.name}
              </Link>
            </nav>

            {/* Action Buttons - Stack on mobile, inline on desktop */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Bookmark button */}
              <BookmarkButton articleId={article.id} variant="outline" />
              {user && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded text-xs font-semibold uppercase tracking-[0.08em] hover:bg-amber-50"
                >
                  Report
                </button>
              )}
              {/* Time spent counter */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/15 rounded text-sm font-semibold text-neutral-700">
                <span className="text-[#b5121b]">⏱️</span>
                <span>{formatTimeSpent(timeSpent)}</span>
              </div>
            </div>
          </div>

          {/* EXPERIMENTAL LAYOUT: Related Articles moved to right sidebar on desktop. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 xl:gap-10 items-start">
            <article ref={articleColumnRef} className="min-w-0">
          {showSubmittedChanges && article.reviewChanges && (
            <SubmittedChangesPanel changes={article.reviewChanges} />
          )}

          {article.imageUrl && (
            <div
              className={`relative ${showAudioReader ? "mb-4" : "mb-8"} rounded-t-lg overflow-hidden max-w-4xl`}
              style={{ aspectRatio: '16/9' }}
            >
              {hasReadyAudio(article) && <ArticleListenBadge />}
              <img
                src={getImageUrl(article.imageUrl) || article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {showAudioReader && audioSrc && (
            <section
              aria-label="Audio reader"
              className="article-audio-player mb-4 max-w-4xl border p-4 sm:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-neutral-900">
                    Listen to this article
                  </h2>
                  <p className="text-xs text-neutral-600 mt-1">
                    Generated audio reader
                  </p>
                </div>
                <span className="article-audio-duration text-xs font-semibold uppercase tracking-[0.1em]">
                  {readTimeMinutes} min read
                </span>
              </div>
              <ArticleAudioPlayer src={audioSrc} />
            </section>
          )}

          <div className="bg-white border border-black/15 shadow-sm p-6 sm:p-10">
            <div className="mb-5 flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/category/${article.category.slug}`}
                  className="inline-flex items-center px-3 py-1 text-xs font-semibold text-[#8f0f16] bg-[#b5121b]/10 uppercase tracking-[0.12em]"
                >
                  {article.category.name}
                </Link>
                {article.articleType === "AMA" && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 uppercase tracking-[0.12em] rounded-full">
                    <span className="animate-pulse w-1.5 h-1.5 bg-amber-500 rounded-full inline-block" />
                    AMA
                    {article.amaExpiresAt && new Date(article.amaExpiresAt) > new Date() && (
                      <span className="ml-1 opacity-75 font-medium lowercase">
                        · ends {new Date(article.amaExpiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                )}
                {article.articleType === "DISCUSSION" && (
                  <span className="inline-flex items-center px-3 py-1 text-xs font-bold bg-blue-100 text-blue-800 uppercase tracking-[0.12em] rounded-full">
                    Discussion
                  </span>
                )}
              </div>

              {/* Rating - moved above title */}
              <a
                href="#article-reviews"
                className="flex items-center gap-2 text-neutral-900 hover:text-[#b5121b] transition-colors whitespace-nowrap"
                title={
                  article.rating.count > 0
                    ? `${article.rating.average.toFixed(1)} out of 5 from ${article.rating.count} ${article.rating.count === 1 ? "review" : "reviews"}`
                    : "No reviews yet — be the first"
                }
              >
                <Stars value={article.rating.average} size={16} />
                {article.rating.count > 0 ? (
                  <span className="text-xs">
                    <span className="font-semibold text-neutral-900">
                      {article.rating.average.toFixed(1)}
                    </span>
                    <span className="text-neutral-500"> ({article.rating.count})</span>
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500">No reviews</span>
                )}
              </a>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight [font-family:Georgia,'Times_New_Roman',serif] text-neutral-900">
              {article.title}
            </h1>

            {cleanExcerpt && (
              <p className="mt-6 text-lg text-neutral-700 leading-relaxed">{cleanExcerpt}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-y-4 text-sm text-neutral-600 mt-8 pb-8 border-b border-black/15">
              <div className="flex items-center gap-2">
                <span className="font-semibold">By</span>
                <Link
                  to={`/author/${article.user.username ?? article.userId}`}
                  className="text-neutral-900 hover:text-[#b5121b] transition-colors"
                >
                  {article.authorName}
                </Link>
                <FollowButton
                  creatorId={article.userId}
                  initialFollowing={article.isFollowingAuthor ?? false}
                  variant="outline"
                  className="ml-1"
                />
              </div>

              <span className="text-neutral-400">•</span>

              {publishedDate && (
                <time dateTime={publicationDateSource ?? undefined} className="flex items-center gap-2">
                  {isArticleUpdated(publicationDateSource, article.updatedAt ?? null)
                    ? `Updated ${formatPublishedDate(article.updatedAt ?? null)}`
                    : publishedDate}
                </time>
              )}

              <span className="text-neutral-400">•</span>

              <span className="flex items-center gap-2">
                {readTimeMinutes} min read
              </span>

              <span className="text-neutral-400">•</span>

              {/* Article read count */}
              {article.views && (
                <span className="flex items-center gap-2">
                  <span className="text-neutral-700">{article.views.totalViews.toLocaleString()} reads</span>
                </span>
              )}

              <span className="text-neutral-400">•</span>

              <a
                href="#article-comments"
                className="flex items-center gap-2 text-neutral-900 hover:text-[#b5121b] transition-colors"
                title="Jump to comments"
              >
                <span>Comments</span>
              </a>
            </div>

            <QuoteShareWrapper
              articleTitle={article.title}
              articleUrl={articleUrl}
            >
              <ArticleBody body={article.body} fallbackAlt={article.title} />
            </QuoteShareWrapper>

            {article.originalSourceUrl && (
              <div className="mt-6 pt-6 border-t border-black/15">
                <p className="text-xs text-neutral-500 font-semibold uppercase tracking-[0.08em] mb-2">
                  Original Source
                </p>
                <a
                  href={article.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-[#b5121b] text-white text-sm font-semibold uppercase tracking-[0.08em] hover:bg-[#8f0f16] transition-colors rounded"
                  title={article.originalSourceUrl}
                >
                  Visit Source
                </a>
              </div>
            )}

            <ArticleReactions articleSlug={article.slug} />

            <AdBanner placement="article" className="my-8" />

            {/* K10: Polls embedded in the article */}
            {polls.length > 0 && (
              <div className="mt-8">
                {polls.map((poll) => (
                  <PollWidget key={poll.id} poll={poll} />
                ))}
              </div>
            )}

            {article.tags.length > 0 && (
              <div className="mt-10 pt-8 border-t border-black/15">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-[0.14em] mb-4">
                  Topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map(({ tag }) => (
                    <TagFollowButton
                      key={tag.id}
                      tagSlug={tag.slug}
                      tagName={tag.name}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
            </article>

            {sidebarTotalCount > 0 && (
              <aside className="mt-10 lg:mt-0">
                <div
                  className="bg-white border border-black/15 rounded-t-lg p-5 flex min-h-0 flex-col overflow-hidden"
                  style={sidebarMaxHeight ? { maxHeight: `${sidebarMaxHeight}px` } : undefined}
                >
                  <h2 className="text-2xl font-bold mb-2 [font-family:Georgia,'Times_New_Roman',serif]">
                    {sidebarHeading}
                  </h2>
                  <p className="text-sm text-neutral-600 mb-5">
                    {sidebarSubtitle}
                  </p>
                  <div className="space-y-5 overflow-y-auto pr-1 min-h-0 flex-1">
                    {renderRelatedAdCard("related_articles_1")}
                    {combinedVisibleArticles.map((r, index) => (
                      <div key={r.slug} className="space-y-5">
                        {visibleLatestArticles.length > 0 &&
                          visibleRelatedArticles.length > 0 &&
                          index === latestSectionStartIndex && (
                            <p className="pt-2 border-t border-black/10 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                              Latest Articles
                            </p>
                          )}
                        <ArticleCard {...r} />
                        {index === 4 && renderRelatedAdCard("related_articles_2")}
                        {index === 9 && renderRelatedAdCard("related_articles_3")}
                      </div>
                    ))}
                  </div>
                  {isMobile && displayedArticlesCount < sidebarTotalCount && (
                    <button
                      onClick={() => setDisplayedArticlesCount((prev) => prev + ARTICLES_PER_PAGE)}
                      className="mt-4 px-4 py-2 bg-black text-white text-sm font-medium uppercase tracking-[0.08em] hover:bg-neutral-800 transition-colors"
                    >
                      Load Next
                    </button>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>

      <section className="bg-gradient-to-b from-[#f2f2ee] to-[#ecece8] dark:from-neutral-900 dark:to-neutral-950 border-t border-black/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-14">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold [font-family:Georgia,'Times_New_Roman',serif] text-neutral-900 dark:text-white">
              Community
            </h2>
            <p className="mt-2 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
              Join the discussion and rate this story.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem] gap-6 xl:gap-8 items-start">
            <div id="article-comments" className="bg-white dark:bg-neutral-800 border border-black/15 dark:border-white/10 shadow-sm p-5 sm:p-7">
              <ArticleComments
                embedded
                articleSlug={article.slug}
                articleId={article.id}
                articleTitle={article.title}
                articleUrl={articleUrl}
                articleAuthorId={article.userId}
              />
            </div>

            <div
              id="article-reviews"
              className="bg-white dark:bg-neutral-800 border border-black/15 dark:border-white/10 shadow-sm p-5 sm:p-7 xl:sticky xl:top-24"
            >
              <ArticleReviews
                embedded
                slug={article.slug}
                initialStats={article.rating}
                authorUserId={article.userId}
              />
            </div>
          </div>
        </div>
      </section>

      {user && (
        <ReportModal
          open={showReportModal}
          targetType="ARTICLE"
          targetId={article.id}
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => alert("Report submitted. You can track it in My Reports.")}
        />
      )}
    </>
  );
}
