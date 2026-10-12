/* Minimal service worker: makes the app installable and shows a friendly page when offline.
   It never caches API calls, the portal or admin pages (money and live data must always be fresh). */
const CACHE = "hifi-shell-v1";
const OFFLINE_URL = "/offline.html";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.mode !== "navigate") return; // only page loads; everything else goes straight to the network
  e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});
