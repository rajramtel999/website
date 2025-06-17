// Import Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "pwabuilder-page";
const offlineFallbackPage = "index.html"; // using your index.html as fallback

// Install event: cache offline fallback page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(offlineFallbackPage))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Enable navigation preload if supported
if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Fetch handler with network-first, fallback to offline
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloadResp = await event.preloadResponse;
          if (preloadResp) {
            return preloadResp;
          }
          const networkResp = await fetch(event.request);
          return networkResp;
        } catch (error) {
          const cache = await caches.open(CACHE);
          const cachedResp = await cache.match(offlineFallbackPage);
          return cachedResp;
        }
      })()
    );
  }
});

// Message listener for skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync example
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sales-data') {
    event.waitUntil(syncSalesData());
  }
});

async function syncSalesData() {
  // Implement your sync logic here
  // e.g., send queued sales data to the server
  return Promise.resolve();
}

// Periodic sync example
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(updateContentInBackground());
  }
});

async function updateContentInBackground() {
  // Implement background update logic here
  return Promise.resolve();
}

// Push notifications handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Mini Vyapar Notification';
  const options = {
    body: data.body || 'You have a new message',
    icon: 'logo.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
