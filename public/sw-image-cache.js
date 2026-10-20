/**
 * Service Worker for Godly Kids - Image Caching Strategy
 * 
 * Implements a stale-while-revalidate strategy for images:
 * - Serves cached images immediately if available
 * - Updates cache in background for next time
 * - Reduces load times and bandwidth usage
 */

const CACHE_NAME = 'godlykids-images-v1';
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// URLs to cache (images from our CDN and storage)
const IMAGE_URL_PATTERNS = [
  /storage\.googleapis\.com/,
  /cloudinary\.com/,
  /\.webp(\?|$)/i,
  /\.jpg(\?|$)/i,
  /\.jpeg(\?|$)/i,
  /\.png(\?|$)/i,
  /\/uploads\//,
  /\/avatars\//,
];

// Check if URL should be cached
const shouldCacheImage = (url) => {
  return IMAGE_URL_PATTERNS.some(pattern => pattern.test(url));
};

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing image cache service worker');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating image cache service worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('godlykids-images-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement stale-while-revalidate for images
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle GET requests for images
  if (request.method !== 'GET' || !shouldCacheImage(url.href)) {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        // Fetch from network in background to update cache
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              // Clone the response before caching
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((error) => {
            console.warn('[SW] Fetch failed for:', url.href, error);
            // Return cached response on network failure
            return cachedResponse;
          });
        
        // Return cached response immediately, or wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Message event - for cache management from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_IMAGE_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Image cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'PREFETCH_IMAGES') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.all(
          urls.map((url) => {
            return fetch(url)
              .then((response) => {
                if (response && response.status === 200) {
                  return cache.put(url, response);
                }
              })
              .catch((error) => {
                console.warn('[SW] Prefetch failed for:', url, error);
              });
          })
        );
      }).then(() => {
        console.log('[SW] Prefetched', urls.length, 'images');
        event.ports[0].postMessage({ success: true, count: urls.length });
      })
    );
  }
});
