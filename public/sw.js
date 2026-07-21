const CACHE_NAME = "wind-intel-v6";
const scopedUrl = (path) => new URL(path, self.registration.scope).toString();
const APP_SHELL = [
  "./",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "vendor/lucide.min.js",
  "assets/gearbox-cover.png",
  "assets/icon-192.png",
  "assets/icon-512.png"
].map(scopedUrl);
const DATA_URL = scopedUrl("data/articles.json");

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.href === DATA_URL) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
