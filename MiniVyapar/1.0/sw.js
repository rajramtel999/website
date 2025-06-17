const CACHE_NAME = 'minivyapar-cache-v1';
const urlsToCache = [
  '/MiniVyapar/1.0/',
  '/MiniVyapar/1.0/index.html',
  '/MiniVyapar/1.0/style.css',
  '/MiniVyapar/1.0/script.js',
  '/MiniVyapar/1.0/logo.png'
];

// Install event: cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event: respond with cache or fetch from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => {
        // Optionally return fallback page/image if offline and request fails
      })
  );
});
