import { fetchOceanMapIslands, getOceanIslandArtSrc } from './oceanMapIslands';

export const ASSET_CACHE_NAME = 'gk-asset-cache-v1';

/** World background, journey-map ocean, and the wood tab bar art. */
export const SHELL_ASSET_URLS = [
  '/assets/images/panorama-background.webp',
  '/world-background.webp',
  '/assets/images/map-ocean-bg.png',
  '/assets/images/map-ocean-scroll.png',
  '/assets/images/map-island-genesis.png',
  '/assets/images/map-sky-cloud-a.png',
  '/assets/images/map-sky-cloud-b.png',
  '/assets/images/map-footer-frame.png',
  '/assets/images/explore-top-header-wood.png',
  '/assets/images/dive-into-bible-button.webp',
  '/assets/images/library-new-releases-bg.png',
  '/assets/images/daily-streak-bg.png',
  '/assets/images/divider-ship-ropes.png',
  '/assets/images/sail-steering-wheel.png',
  '/assets/ui/tab-map.png',
  '/assets/images/island-star-win.png',
  '/assets/videos/onboarding-genesis-arrival.mp4',
];

const inflight = new Map<string, Promise<void>>();

const isVideo = (url: string) => /\.(mp4|webm)(\?|$)/i.test(url);

const shouldSkipHeavy = (): boolean => {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
};

/** Decode an image so the next screen can paint it from the browser image cache. */
const warmImage = (url: string) => {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
};

async function storeOne(cache: Cache, url: string): Promise<void> {
  const existing = inflight.get(url);
  if (existing) return existing;
  const job = (async () => {
    try {
      if (await cache.match(url)) {
        if (!isVideo(url)) warmImage(url);
        return;
      }
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (response.ok) await cache.put(url, response.clone());
    } catch {
      /* private mode or a blocked host — the image warm below still helps */
    }
    if (!isVideo(url)) warmImage(url);
  })().finally(() => inflight.delete(url));
  inflight.set(url, job);
  return job;
}

/** Fetch assets into the Cache API, a few at a time. Already-stored URLs are skipped. */
export async function cacheAssetUrls(urls: string[]): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    urls.forEach((url) => {
      if (url && !isVideo(url)) warmImage(url);
    });
    return;
  }
  const unique = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  let cache: Cache;
  try {
    cache = await caches.open(ASSET_CACHE_NAME);
  } catch {
    unique.forEach((url) => {
      if (!isVideo(url)) warmImage(url);
    });
    return;
  }
  const queue = [...unique];
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) return;
      if (isVideo(url) && shouldSkipHeavy()) continue;
      await storeOne(cache, url);
    }
  });
  await Promise.all(workers);
}

/** Island paintings and each island's main-map background, once the voyage list is known. */
export async function cacheIslandBackgrounds(): Promise<void> {
  try {
    const islands = await fetchOceanMapIslands();
    if (!islands) return;
    const urls: string[] = [];
    for (const island of islands) {
      const art = getOceanIslandArtSrc(island);
      if (art) urls.push(art);
      if (island.sailArtUrl) urls.push(island.sailArtUrl);
      if (island.mainMapUrl) urls.push(island.mainMapUrl);
      if (island.mainMapVideoUrl) urls.push(island.mainMapVideoUrl);
    }
    await cacheAssetUrls(urls);
  } catch {
    /* map still loads from the network */
  }
}

export function registerAssetCacheWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('/asset-cache-sw.js').catch(() => {});
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Warm the shell art, then the island backgrounds, without blocking the first screen. */
export function startAssetCache(): void {
  registerAssetCacheWorker();
  const run = () => {
    void cacheAssetUrls(SHELL_ASSET_URLS);
    void cacheIslandBackgrounds();
  };
  const idle = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof idle === 'function') idle(() => run(), { timeout: 1800 });
  else window.setTimeout(run, 500);
}
