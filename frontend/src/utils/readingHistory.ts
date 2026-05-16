/**
 * readingHistory — localStorage-backed reading history for anonymous visitors.
 *
 * The homepage uses this to personalise the "Main Article" for users who
 * aren't logged in. We store:
 *   - readArticleIds: dedup set of article ids the user has opened
 *   - reads:          [{ articleId, categoryId, readAt }] log used to compute
 *                      the favourite category over the last 60 days
 *
 * Constraints:
 *   - Throttled: opening the same article within 30 minutes counts once.
 *   - Capped: we keep at most MAX_ENTRIES of the most recent reads — old
 *             history is pruned so localStorage doesn't grow forever.
 *   - GDPR-friendly: only article/category ids + timestamps. No PII.
 *   - Resilient: any read/parse error returns empty data (never throws).
 *
 * The data is sent to POST /api/home/main-article so the backend can pick
 * a personalised article without our visitor needing an account.
 */

const STORAGE_KEY = "ucs.readingHistory.v1";
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 200;

export interface ReadEntry {
  articleId: string;
  categoryId: string;
  readAt: string; // ISO 8601
}

interface StoredHistory {
  reads: ReadEntry[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Safe load — returns an empty history on any parsing error. */
function load(): StoredHistory {
  if (!isBrowser()) return { reads: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { reads: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.reads)) {
      return { reads: [] };
    }
    const reads: ReadEntry[] = [];
    for (const entry of parsed.reads) {
      if (!entry || typeof entry !== "object") continue;
      const articleId = typeof entry.articleId === "string" ? entry.articleId : null;
      const categoryId = typeof entry.categoryId === "string" ? entry.categoryId : null;
      const readAt = typeof entry.readAt === "string" ? entry.readAt : null;
      if (!articleId || !categoryId || !readAt) continue;
      if (Number.isNaN(Date.parse(readAt))) continue;
      reads.push({ articleId, categoryId, readAt });
    }
    return { reads };
  } catch {
    return { reads: [] };
  }
}

function save(state: StoredHistory): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — silently ignore. Personalisation
    // simply won't improve until storage is available again.
  }
}

/**
 * Record that the user just opened an article. Throttled: a second call for
 * the same article within 30 minutes is silently ignored so refresh-spam
 * doesn't poison the history.
 */
export function recordArticleRead(articleId: string, categoryId: string): void {
  if (!articleId || !categoryId) return;
  const state = load();
  const now = Date.now();
  const cutoffDup = now - THIRTY_MINUTES_MS;

  // Dedup-by-recency: skip if same article was logged in the last 30 minutes.
  for (const entry of state.reads) {
    if (entry.articleId !== articleId) continue;
    if (Date.parse(entry.readAt) >= cutoffDup) return; // recent dup → skip
  }

  state.reads.push({ articleId, categoryId, readAt: new Date(now).toISOString() });

  // Cap size: keep only the most recent MAX_ENTRIES (sorted by readAt desc).
  if (state.reads.length > MAX_ENTRIES) {
    state.reads.sort((a, b) => Date.parse(b.readAt) - Date.parse(a.readAt));
    state.reads.length = MAX_ENTRIES;
  }

  save(state);
}

/** Build the payload sent to POST /api/home/main-article for anonymous users. */
export function getReadingHistoryPayload(): {
  readArticleIds: string[];
  reads: ReadEntry[];
} {
  const state = load();
  const cutoff = Date.now() - SIXTY_DAYS_MS;

  // The unread-filter on the backend uses the FULL set of read ids (no time
  // limit) so we don't keep showing already-seen articles, but the favourite
  // category is computed only over the last 60 days of reads.
  const ids = new Set<string>();
  const recentReads: ReadEntry[] = [];
  for (const entry of state.reads) {
    ids.add(entry.articleId);
    if (Date.parse(entry.readAt) >= cutoff) recentReads.push(entry);
  }

  return { readArticleIds: Array.from(ids), reads: recentReads };
}

/** For tests / manual reset (e.g. exposed via a "Reset preferences" button). */
export function clearReadingHistory(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
