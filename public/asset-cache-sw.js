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

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode === 'navigate') return;
  // Safari probes video with byte ranges. A cached 200 response cannot
  // satisfy that request; let the browser/server negotiate streaming.
  if (request.headers.has('range') || request.destination === 'video' || request.destination === 'audio') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (/\.(mp4|webm|mov|m4v|m3u8|mp3|m4a|aac|ogg|wav)$/i.test(url.pathname)) return;
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
