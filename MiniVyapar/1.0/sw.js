// Import Workbox from Google's CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// Set cache name
const CACHE = 'pwabuilder-offline-cache-v1';

// ✅ Replace with your actual offline fallback page
const offlineFallbackPage = '/MiniVyapar/1.0/offline.html';  // make sure this file exists!

// Handle skipWaiting from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// On install: cache offline fallback page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

// Enable navigation preload
if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Handle fetch for navigation (i.e., full page loads)
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Try preloaded response
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;

        // Try network
        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        // If both fail, show cached offline fallback
        const cache = await caches.open(CACHE);
        return await cache.match(offlineFallbackPage);
      }
    })());
  }
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
      event.waitUntil(syncContent());
    }
  });
  
  async function syncContent() {
    try {
      // Example: fetch latest data or update cache here
      const cache = await caches.open('pwabuilder-offline-cache-v1');
  
      // Fetch fresh content, e.g., your API or assets
      const response = await fetch('/MiniVyapar/1.0/api/latest-data'); // update URL accordingly
  
      if (response.ok) {
        await cache.put('/MiniVyapar/1.0/api/latest-data', response.clone());
        console.log('Background sync: content updated');
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }
  