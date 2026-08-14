// Weekly Meal Planner — offline cache
// NOTE: index.html is now served "network-first" (see fetch handler below),
// so you do NOT need to bump CACHE_NAME just because index.html changed.
// Only bump this if you rename/add/remove files in APP_SHELL below.
const CACHE_NAME = "meal-planner-cache-v10";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png"
];

// Install: pre-cache the app shell so it works fully offline right away.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up any old cache versions and take control immediately.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch:
// - HTML page (navigations, and index.html itself): NETWORK-FIRST.
//   Always try to get the latest version. Only fall back to the cached
//   copy if the network request fails (i.e. you're offline). This means
//   deploying a new index.html shows up immediately on a normal reload —
//   no more manual cache-version bumping, no more hard refresh needed.
// - Other same-origin files (manifest, icons): CACHE-FIRST, since they
//   rarely change and this keeps the app opening instantly offline.
// - Cross-origin requests (Google Fonts, etc.): network-first, cache fallback.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isHTML =
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/");

  if (isSameOrigin && isHTML) {
    // Network-first for the page itself.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
  } else if (isSameOrigin) {
    // Cache-first for other app-shell files (manifest, icons).
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match("./index.html"));
      })
    );
  } else {
    // Cross-origin: network-first, cache fallback, fail quietly.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
