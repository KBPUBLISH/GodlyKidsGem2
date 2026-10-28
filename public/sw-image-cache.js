/**
 * Service Worker for Godly Kids - Image Caching Strategy
 * 
 * Implements a stale-while-revalidate strategy for images:
 * - Serves cached images immediately if available
 * - Updates cache in background for next time
 * - Reduces load times and bandwidth usage
 */

const CACHE_NAME = 'godlykids-images-v1';

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|mp4|webm|glb)(\?|#|$)/i;

/** Pictures, sail/island videos, and parrot models. Never scripts or pages. */
const shouldCacheMedia = (url) => {
  const path = `${url.pathname}${url.search}`;
  if (!MEDIA_EXT.test(path) && !/\/uploads\//.test(path) && !/\/avatars\//.test(path)) {
    return false;
  }
  if (url.origin === self.location.origin) {
    return (
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/homeworld/assets/') ||
      url.pathname.startsWith('/homeworld/icons/') ||
      url.pathname.startsWith('/models/') ||
      url.pathname === '/world-background.webp'
    );
  }
  const host = url.hostname;
  return (
    host.endsWith('storage.googleapis.com') ||
    host.endsWith('googleusercontent.com') ||
    host.endsWith('cloudinary.com') ||
    /\/uploads\//.test(path) ||
    /\/avatars\//.test(path)
  );
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

// Cache-first for pictures, videos, and models so a later visit works off Wi-Fi.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!shouldCacheMedia(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request) || await cache.match(url.href);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.warn('[SW] Fetch failed for:', url.href, error);
        return cached || new Response('', { status: 503, statusText: 'Offline' });
      }
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
