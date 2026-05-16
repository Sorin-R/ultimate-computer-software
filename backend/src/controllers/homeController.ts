import { Request, Response } from "express";
import prisma from "../config/db";

/**
 * Personalised "Main Article" algorithm
 * --------------------------------------
 * The homepage shows ONE lead article. We choose it like this:
 *
 *   Main Article = latest UNREAD article from the user's most-read category in
 *                  the last 60 days.
 *
 * Fallback chain (each step only if the previous returned nothing):
 *   1. Latest UNREAD published article from favourite category
 *   2. Latest published article from favourite category (even if read)
 *   3. Latest published article overall
 *
 * Reading history source:
 *   - Logged-in user → ArticleView rows where userId = current user
 *   - Anonymous user → readArticleIds + categoryReads passed in the POST body
 *                       (the frontend stores them in localStorage)
 *
 * Tie-breakers when two categories have the same read count:
 *   1. Most recently read category wins
 *   2. Otherwise: category with the most recent published article
 *   3. Otherwise: alphabetical (deterministic)
 */

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_ANON_HISTORY = 500; // sanity cap on body size

type AnonReadEntry = { articleId: string; categoryId: string; readAt: string };

interface AnonPayload {
  readArticleIds: string[];
  reads: AnonReadEntry[];
}

/** Defensive parser for the optional anonymous reading-history body. Anything
 *  malformed is silently ignored — we never trust client localStorage. */
function parseAnonPayload(body: unknown): AnonPayload {
  const empty: AnonPayload = { readArticleIds: [], reads: [] };
  if (!body || typeof body !== "object") return empty;
  const raw = body as Record<string, unknown>;

  const readArticleIds: string[] = [];
  if (Array.isArray(raw.readArticleIds)) {
    for (const id of raw.readArticleIds) {
      if (typeof id === "string" && id.length > 0 && id.length < 100) {
        readArticleIds.push(id);
      }
      if (readArticleIds.length >= MAX_ANON_HISTORY) break;
    }
  }

  const reads: AnonReadEntry[] = [];
  if (Array.isArray(raw.reads)) {
    for (const entry of raw.reads) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const articleId = typeof e.articleId === "string" ? e.articleId : null;
      const categoryId = typeof e.categoryId === "string" ? e.categoryId : null;
      const readAt = typeof e.readAt === "string" ? e.readAt : null;
      if (!articleId || !categoryId || !readAt) continue;
      const ts = Date.parse(readAt);
      if (Number.isNaN(ts)) continue;
      reads.push({ articleId, categoryId, readAt: new Date(ts).toISOString() });
      if (reads.length >= MAX_ANON_HISTORY) break;
    }
  }

  return { readArticleIds, reads };
}

/** Build a per-category aggregate {count, lastReadAt} from raw reads,
 *  filtered to the last 60 days. */
function aggregateReads(
  reads: { categoryId: string; readAtMs: number }[],
  nowMs: number
) {
  const cutoff = nowMs - SIXTY_DAYS_MS;
  const buckets = new Map<string, { count: number; lastReadAt: number }>();
  for (const r of reads) {
    if (r.readAtMs < cutoff) continue;
    const cur = buckets.get(r.categoryId);
    if (!cur) buckets.set(r.categoryId, { count: 1, lastReadAt: r.readAtMs });
    else {
      cur.count += 1;
      if (r.readAtMs > cur.lastReadAt) cur.lastReadAt = r.readAtMs;
    }
  }
  return buckets;
}

/** Pick the favourite category id given the buckets, breaking ties using:
 *   1. higher count
 *   2. more recently read
 *   3. alphabetical (deterministic) */
function pickFavouriteCategoryId(
  buckets: Map<string, { count: number; lastReadAt: number }>
): string | null {
  let best: { id: string; count: number; lastReadAt: number } | null = null;
  for (const [id, agg] of buckets) {
    if (
      !best ||
      agg.count > best.count ||
      (agg.count === best.count && agg.lastReadAt > best.lastReadAt) ||
      (agg.count === best.count &&
        agg.lastReadAt === best.lastReadAt &&
        id < best.id)
    ) {
      best = { id, count: agg.count, lastReadAt: agg.lastReadAt };
    }
  }
  return best?.id ?? null;
}

const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  authorName: true,
  imageUrl: true,
  audioUrl: true,
  audioStatus: true,
  publishedAt: true,
  createdAt: true,
  userId: true, // needed for subscription-aware ranking
  category: { select: { id: true, name: true, slug: true } },
} as const;

type RawArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioStatus: "NONE" | "PROCESSING" | "READY" | "FAILED";
  publishedAt: Date | null;
  createdAt: Date;
  category: { id: string; name: string; slug: string };
};

/** Hydrate a raw article with views/rating aggregates so the homepage can
 *  render its existing card UI without extra round-trips. */
async function decorateArticle(article: RawArticle) {
  const [views, rating] = await Promise.all([
    prisma.articleView.count({ where: { articleId: article.id } }),
    prisma.review.aggregate({
      where: { articleId: article.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    authorName: article.authorName,
    imageUrl: article.imageUrl,
    audioUrl: article.audioUrl,
    audioStatus: article.audioStatus,
    publishedAt: article.publishedAt ?? article.createdAt,
    createdAt: article.createdAt,
    publishedDate: article.publishedAt ?? article.createdAt,
    category: article.category,
    views,
    averageRating: rating._avg.rating ?? 0,
    ratingCount: rating._count._all,
  };
}

/**
 * POST /api/home/main-article
 * (POST so anonymous clients can send their localStorage history in the body
 *  without exposing it in the URL or query string.)
 *
 * Body for anonymous users (all optional, all validated):
 *   {
 *     "readArticleIds": ["cuid", ...],
 *     "reads": [{ articleId, categoryId, readAt }, ...]
 *   }
 *
 * Logged-in users: body is ignored, history is read from the database.
 */
export async function getMainArticle(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId ?? null;
  const nowMs = Date.now();
  const cutoff = new Date(nowMs - SIXTY_DAYS_MS);

  // ---- Step 1: build reading history & favourite category --------------
  let favouriteCategoryId: string | null = null;
  let readArticleIds = new Set<string>();

  if (userId) {
    // Logged-in: pull from ArticleView. Each row is `{userId, articleId, createdAt}`,
    // and we already have a relation to article.categoryId.
    const recentViews = await prisma.articleView.findMany({
      where: { userId, createdAt: { gte: cutoff } },
      select: { createdAt: true, article: { select: { id: true, categoryId: true } } },
    });

    const reads = recentViews.map((v) => ({
      categoryId: v.article.categoryId,
      readAtMs: v.createdAt.getTime(),
    }));
    favouriteCategoryId = pickFavouriteCategoryId(aggregateReads(reads, nowMs));

    // We also need the *full* set of read article ids (no time limit) so we
    // can tell which articles to skip. Use a separate query selecting only ids.
    const allReads = await prisma.articleView.findMany({
      where: { userId },
      select: { articleId: true },
    });
    readArticleIds = new Set(allReads.map((r) => r.articleId));
  } else {
    // Anonymous: trust the localStorage payload (validated).
    const anon = parseAnonPayload(req.body);
    const reads = anon.reads.map((r) => ({
      categoryId: r.categoryId,
      readAtMs: Date.parse(r.readAt),
    }));
    favouriteCategoryId = pickFavouriteCategoryId(aggregateReads(reads, nowMs));
    readArticleIds = new Set(anon.readArticleIds);
  }

  // ---- Step 2: try to find the personalised article --------------------
  let chosen: RawArticle | null = null;
  let source:
    | "personalised_unread"
    | "personalised_repeat"
    | "global_latest"
    | "none" = "none";

  if (favouriteCategoryId) {
    // 2a) Latest UNREAD article in the favourite category.
    chosen = await prisma.article.findFirst({
      where: {
        status: "PUBLISHED",
        categoryId: favouriteCategoryId,
        id: { notIn: Array.from(readArticleIds) },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: ARTICLE_SELECT,
    });
    if (chosen) source = "personalised_unread";

    // 2b) If everything in the favourite category has been read, fall back
    //     to the latest article in that category (even if read).
    if (!chosen) {
      chosen = await prisma.article.findFirst({
        where: { status: "PUBLISHED", categoryId: favouriteCategoryId },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: ARTICLE_SELECT,
      });
      if (chosen) source = "personalised_repeat";
    }
  }

  // ---- Step 3: global fallback -----------------------------------------
  if (!chosen) {
    chosen = await prisma.article.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: ARTICLE_SELECT,
    });
    if (chosen) source = "global_latest";
  }

  if (!chosen) {
    res.json({ article: null, source: "none", personalised: false });
    return;
  }

  const decorated = await decorateArticle(chosen);
  res.json({
    article: decorated,
    source,
    personalised: source === "personalised_unread" || source === "personalised_repeat",
    favouriteCategoryId,
  });
}

/* ------------------------------------------------------------------ */
/* Article feed (Latest News list / Category list) with sort buttons. */
/* ------------------------------------------------------------------ */

const VALID_FEED_SORTS = [
  "recommended", // default — favourite category + freshness, unread bonus
  "latest", //   newest first by publishedAt
  "most_read", // total view count desc
  "top_rated", // avg rating desc, with min-review threshold
  "trending", //  most views in last 7 days
] as const;
type FeedSort = (typeof VALID_FEED_SORTS)[number];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function resolveFeedSort(raw: unknown): FeedSort {
  if (typeof raw !== "string") return "recommended";
  return (VALID_FEED_SORTS as readonly string[]).includes(raw)
    ? (raw as FeedSort)
    : "recommended";
}

interface FeedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioStatus: "NONE" | "PROCESSING" | "READY" | "FAILED";
  publishedAt: Date | null;
  createdAt: Date;
  authorId: string;
  category: { id: string; name: string; slug: string };
  views: number;
  averageRating: number;
  ratingCount: number;
  // present when the request asked for the recommended sort
  isUnread?: boolean;
  isFavouriteCategory?: boolean;
  isFromSubscribedCreator?: boolean;
}

/**
 * POST /api/home/feed
 *
 * Body (all optional):
 *   {
 *     "sort":       "recommended" | "latest" | "most_read" | "top_rated" | "trending",
 *     "categoryId": "<id>" or "categorySlug": "<slug>",
 *     "page":       1,
 *     "limit":      18,
 *     // anonymous reading-history (only used when sort=recommended and no auth)
 *     "readArticleIds": [...],
 *     "reads":          [{articleId, categoryId, readAt}, ...]
 *   }
 *
 * Returns a paginated list of articles ranked by the chosen sort. The
 * "recommended" sort uses the same favourite-category algorithm as the
 * Main Article: articles in the user's favourite category float to the top,
 * unread articles win their category tie-breaker, and freshness is the final
 * tie-breaker. For "trending" we count only views from the last 7 days.
 */
export async function getFeed(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sort = resolveFeedSort(body.sort);
  const userId = req.user?.userId ?? null;

  const page = Math.max(1, Number.isFinite(Number(body.page)) ? Number(body.page) : 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.isFinite(Number(body.limit)) ? Number(body.limit) : 18)
  );

  // Optional category filter (id wins over slug).
  let categoryId: string | null =
    typeof body.categoryId === "string" && body.categoryId.length > 0
      ? body.categoryId
      : null;
  if (!categoryId && typeof body.categorySlug === "string") {
    const cat = await prisma.category.findUnique({
      where: { slug: body.categorySlug },
      select: { id: true },
    });
    if (cat) categoryId = cat.id;
  }

  const where: { status: "PUBLISHED"; categoryId?: string } = { status: "PUBLISHED" };
  if (categoryId) where.categoryId = categoryId;
  const nowMs = Date.now();
  const start = (page - 1) * limit;
  const total = await prisma.article.count({ where });

  // Anonymous non-personalized feed responses are safe to cache briefly.
  if (!userId && sort !== "recommended") {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
  } else {
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  }

  // Fast path: latest can be paginated directly in SQL.
  if (sort === "latest") {
    const latestArticles = await prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: start,
      take: limit,
      select: ARTICLE_SELECT,
    });
    const latestIds = latestArticles.map((a) => a.id);
    const [viewAgg, ratingAgg] = await Promise.all([
      latestIds.length
        ? prisma.articleView.groupBy({
            by: ["articleId"],
            where: { articleId: { in: latestIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      latestIds.length
        ? prisma.review.groupBy({
            by: ["articleId"],
            where: { articleId: { in: latestIds } },
            _avg: { rating: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    const viewsById = new Map(viewAgg.map((r) => [r.articleId, r._count._all]));
    const ratingsById = new Map(
      ratingAgg.map((r) => [r.articleId, { avg: r._avg.rating ?? 0, count: r._count._all }])
    );

    const latestFeed = latestArticles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      authorName: a.authorName,
      imageUrl: a.imageUrl,
      audioUrl: a.audioUrl,
      audioStatus: a.audioStatus,
      publishedAt: a.publishedAt ?? a.createdAt,
      createdAt: a.createdAt,
      authorId: a.userId,
      category: a.category,
      views: viewsById.get(a.id) ?? 0,
      averageRating: ratingsById.get(a.id)?.avg ?? 0,
      ratingCount: ratingsById.get(a.id)?.count ?? 0,
    }));

    res.json({
      sort,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      favouriteCategoryId: null,
      personalised: false,
      articles: latestFeed,
    });
    return;
  }

  // ---- Reading history needed for the recommended sort --------------
  let favouriteCategoryId: string | null = null;
  let readSet = new Set<string>();
  let subscribedCreatorIds = new Set<string>();
  if (sort === "recommended") {
    if (userId) {
      const cutoff = new Date(nowMs - SIXTY_DAYS_MS);
      const recent = await prisma.articleView.findMany({
        where: { userId, createdAt: { gte: cutoff } },
        select: { createdAt: true, article: { select: { categoryId: true } } },
      });
      favouriteCategoryId = pickFavouriteCategoryId(
        aggregateReads(
          recent.map((v) => ({
            categoryId: v.article.categoryId,
            readAtMs: v.createdAt.getTime(),
          })),
          nowMs
        )
      );
      const [allReads, subs] = await Promise.all([
        prisma.articleView.findMany({
          where: { userId },
          select: { articleId: true },
        }),
        prisma.subscription.findMany({
          where: { subscriberId: userId, mutedAt: null },
          select: { creatorId: true },
        }),
      ]);
      readSet = new Set(allReads.map((r) => r.articleId));
      subscribedCreatorIds = new Set(subs.map((s) => s.creatorId));
    } else {
      const anon = parseAnonPayload(body);
      favouriteCategoryId = pickFavouriteCategoryId(
        aggregateReads(
          anon.reads.map((r) => ({
            categoryId: r.categoryId,
            readAtMs: Date.parse(r.readAt),
          })),
          nowMs
        )
      );
      readSet = new Set(anon.readArticleIds);
    }
  }

  // Bounded candidate set to avoid loading all published rows on every request.
  const candidateMultiplierBySort: Record<FeedSort, number> = {
    recommended: 20,
    latest: 1,
    most_read: 14,
    top_rated: 14,
    trending: 14,
  };
  const candidateTake = Math.min(
    1000,
    Math.max(200, (page * limit) * candidateMultiplierBySort[sort])
  );

  const candidates = await prisma.article.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: candidateTake,
    select: ARTICLE_SELECT,
  });

  const candidateIds = candidates.map((a) => a.id);
  const [viewAgg, ratingAgg, trendingAgg] = await Promise.all([
    candidateIds.length
      ? prisma.articleView.groupBy({
          by: ["articleId"],
          where: { articleId: { in: candidateIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    candidateIds.length
      ? prisma.review.groupBy({
          by: ["articleId"],
          where: { articleId: { in: candidateIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    sort === "trending" && candidateIds.length
      ? prisma.articleView.groupBy({
          by: ["articleId"],
          where: {
            articleId: { in: candidateIds },
            createdAt: { gte: new Date(nowMs - SEVEN_DAYS_MS) },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const viewsById = new Map(viewAgg.map((r) => [r.articleId, r._count._all]));
  const ratingsById = new Map(
    ratingAgg.map((r) => [r.articleId, { avg: r._avg.rating ?? 0, count: r._count._all }])
  );
  const trendingById = new Map(trendingAgg.map((r) => [r.articleId, r._count._all]));

  const items: FeedArticle[] = candidates.map((a) => {
    const rating = ratingsById.get(a.id);
    return {
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      authorName: a.authorName,
      imageUrl: a.imageUrl,
      audioUrl: a.audioUrl,
      audioStatus: a.audioStatus,
      publishedAt: a.publishedAt ?? a.createdAt,
      createdAt: a.createdAt,
      authorId: a.userId,
      category: a.category,
      views: viewsById.get(a.id) ?? 0,
      averageRating: rating?.avg ?? 0,
      ratingCount: rating?.count ?? 0,
      isUnread: !readSet.has(a.id),
      isFavouriteCategory:
        favouriteCategoryId !== null && a.category.id === favouriteCategoryId,
      isFromSubscribedCreator: subscribedCreatorIds.has(a.userId),
    };
  });

  const dateMs = (a: FeedArticle) => (a.publishedAt ?? a.createdAt).getTime();

  if (sort === "most_read") {
    items.sort((a, b) => b.views - a.views || dateMs(b) - dateMs(a));
  } else if (sort === "top_rated") {
    const eligible = (a: FeedArticle) => a.ratingCount >= 3;
    items.sort((a, b) => {
      const ae = eligible(a) ? 1 : 0;
      const be = eligible(b) ? 1 : 0;
      if (be !== ae) return be - ae;
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      return dateMs(b) - dateMs(a);
    });
  } else if (sort === "trending") {
    items.sort((a, b) => {
      const av = trendingById.get(a.id) ?? 0;
      const bv = trendingById.get(b.id) ?? 0;
      if (bv !== av) return bv - av;
      return dateMs(b) - dateMs(a);
    });
  } else {
    // recommended (subscription-aware):
    // 1) followed creators, 2) favourite category, 3) unread, 4) freshness.
    items.sort((a, b) => {
      const aSub = a.isFromSubscribedCreator ? 1 : 0;
      const bSub = b.isFromSubscribedCreator ? 1 : 0;
      if (bSub !== aSub) return bSub - aSub;
      const aFav = a.isFavouriteCategory ? 1 : 0;
      const bFav = b.isFavouriteCategory ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav;
      const aUn = a.isUnread ? 1 : 0;
      const bUn = b.isUnread ? 1 : 0;
      if (bUn !== aUn) return bUn - aUn;
      return dateMs(b) - dateMs(a);
    });
  }

  const paged = items.slice(start, start + limit);

  res.json({
    sort,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    favouriteCategoryId,
    personalised: sort === "recommended" && favouriteCategoryId !== null,
    articles: paged,
  });
}

/**
 * GET /api/home/from-your-follows
 *
 * Used by the homepage's "From your follows" strip (U4). Returns the latest
 * articles from creators the current user has subscribed to (excluding muted
 * creators). Empty array if not logged in or has no follows.
 */
export async function getFromYourFollows(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.json({ articles: [] });
    return;
  }

  const subs = await prisma.subscription.findMany({
    where: { subscriberId: userId, mutedAt: null },
    select: { creatorId: true },
  });
  const creatorIds = subs.map((s) => s.creatorId);
  if (creatorIds.length === 0) {
    res.json({ articles: [] });
    return;
  }

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED", userId: { in: creatorIds } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      authorName: true,
      imageUrl: true,
      audioUrl: true,
      audioStatus: true,
      publishedAt: true,
      createdAt: true,
      userId: true,
      category: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  res.json({ articles });
}
