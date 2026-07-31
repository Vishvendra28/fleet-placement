const CACHE = 'fleet-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('fetch', (e) => {
  // Always network-first — app requires live data
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
