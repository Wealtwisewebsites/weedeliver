// WeeDeliver service worker — network-first, self-healing.
// Online users ALWAYS get the latest app (no stale cache = no blank screens).
// The cache is used only as an offline fallback. Only same-origin GET requests are handled;
// API calls (Render), Yoco, Supabase and fonts pass through untouched.
const CACHE = "weedeliver-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Purge ALL previous caches (recovers anyone stuck on an old/broken cache) then take control.
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave API/cross-origin alone

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.mode === "navigate" ? caches.match("/index.html") : undefined)
        )
      )
  );
});
