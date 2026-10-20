/* Cache-first for shell art and island backgrounds. Never touch page navigations. */
const CACHE = 'gk-asset-cache-v1';

const isMediaPath = (pathname) =>
  /\.(png|jpe?g|webp|gif|avif|mp4|webm)$/i.test(pathname);

const isCacheableAsset = (url, destination) => {
  if (url.origin === self.location.origin) {
    const shell =
      url.pathname.startsWith('/assets/') || url.pathname === '/world-background.webp';
    return shell && isMediaPath(url.pathname);
  }
  const host = url.hostname;
  const mediaHost =
    host.endsWith('storage.googleapis.com') || host.endsWith('googleusercontent.com');
  return mediaHost && (destination === 'image' || destination === 'video');
};

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode === 'navigate') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  const kind = request.destination;
  if (!isCacheableAsset(url, kind)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    }),
  );
});
