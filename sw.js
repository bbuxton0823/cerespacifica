const CACHE_NAME = 'ceres-hqs-v1';

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Tell the active service worker to take control of the page immediately.
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy to ensure latest inspection data/code
  event.respondWith(
    fetch(event.request).catch(() => {
      // Optional: Return a cached offline fallback if you implement caching logic later
      return new Response("Offline - Internet connection required for AI features.");
    })
  );
});