const CACHE = "bosba-v2";
const ASSET_RE = /\/assets\//;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Auth and server functions must always reach the network — never cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return;

  // Hashed build assets are immutable: cache-first.
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Page navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put("/", res.clone());
          return res;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match("/")) || Response.error();
        }
      })(),
    );
  }
});
