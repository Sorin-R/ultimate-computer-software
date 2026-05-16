/**
 * Ultimate Computer Software — Service Worker
 *
 * Strategy:
 *  • App shell (HTML, JS, CSS)  → Network-first, fall back to cache.
 *  • Static assets (fonts, SVG) → Cache-first, fall back to network.
 *  • API calls (/api/*)          → Network only (never cache user data).
 *  • Uploads (/uploads/*)        → Stale-while-revalidate for images.
 *
 * Push notifications (R7): the `push` handler receives JSON payloads from
 * the backend and shows a notification. The backend endpoint
 * POST /api/push/subscribe stores the subscription; users opt in from the
 * dashboard Notifications settings (not yet built — skeleton only).
 */

const CACHE_NAME = "ucs-v1";
const STATIC_CACHE = "ucs-static-v1";

// Assets to pre-cache on install (app shell).
const PRECACHE_URLS = ["/", "/manifest.json", "/favicon.svg"];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-HTTP(S) requests.
  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // API calls — network only.
  if (url.pathname.startsWith("/api/")) return;

  // Upload images — stale-while-revalidate.
  if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Static assets (fonts, icons, svg) — cache-first.
  if (
    url.pathname.match(/\.(svg|png|jpg|jpeg|webp|woff2?|ttf|eot|ico)$/i)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else (HTML, JS chunks, CSS) — network-first.
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// ── Push notifications ─────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const title = data.title ?? "Ultimate Computer Software";
  const options = {
    body: data.body ?? "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url ?? "/" },
    tag: data.tag ?? "ucs-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url === url && "focus" in c);
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});

// ── Cache helpers ──────────────────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(cacheName).then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached ?? (await networkPromise) ?? new Response("Not found", { status: 404 });
}
