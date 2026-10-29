import {
  ONBOARDING_FAMILY_BG_POSTER,
  ONBOARDING_FAMILY_BG_VIDEO,
  ONBOARDING_GENESIS_VIDEO,
} from './onboardingJourney';
import { fetchOceanMapIslands, getOceanIslandArtSrc } from './oceanMapIslands';

/** Same bucket the media service worker serves from. */
export const ASSET_CACHE_NAME = 'godlykids-images-v1';

/** Perry's flight clips used on the splash and the first voyage. */
const PARROT_MODEL_URLS = [
  '/models/perry-flight-essentials.glb?v=flight-3',
];

/** Sail deck background, boat, and clouds. */
const SAIL_ASSET_URLS = [
  '/assets/videos/sail-ocean-bg.mp4',
  '/assets/images/sail-scene-bg.png',
  '/assets/images/sail-ship-deck.png',
  '/assets/images/sail-steering-wheel.png',
  '/assets/images/sail-btn-crew.png',
  '/assets/images/sail-btn-explore.png',
  '/assets/images/wheel-background-wood.png',
  '/assets/images/sail-bg-cloud-a.png',
  '/assets/images/sail-bg-cloud-b.png',
];

/**
 * The crew ship (first screen after onboarding): hull, sea panorama, bow with
 * the wheel and the four tab tiles, hatch, horizon islands. Keep the `?v=`
 * tags in step with pages/CrewPage.tsx — the cache key is the full URL.
 */
const CREW_SHIP_ASSET_URLS = [
  '/assets/images/sail-voyage-hull.webp?v=1',
  '/assets/images/crew-voyage-sea-pano.webp?v=1',
  '/assets/images/crew-voyage-bow.webp?v=1',
  '/assets/images/crew-button-plank.webp?v=1',
  '/assets/images/sail-voyage-wheel.webp?v=1',
  '/assets/images/crew-voyage-hatch.webp?v=1',
  '/assets/images/sail-voyage-tab-home.webp?v=2',
  '/assets/images/sail-voyage-tab-crew.webp?v=1',
  '/assets/images/sail-voyage-tab-profile.webp?v=1',
  '/assets/images/sail-voyage-tab-library.webp?v=1',
  '/assets/images/sail-tab-wood.webp?v=1',
  '/assets/images/crew-horizon-island-a.webp?v=1',
  '/assets/images/crew-horizon-island-b.webp?v=1',
];

const ONBOARDING_MEDIA_URLS = [
  ONBOARDING_FAMILY_BG_VIDEO,
  ONBOARDING_FAMILY_BG_POSTER,
  ONBOARDING_GENESIS_VIDEO,
];

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
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw-image-cache.js').catch(() => {});
}

export type AdventurePreloadProgress = {
  loadedBytes: number;
  totalBytes: number;
  finished: boolean;
};

const listeners = new Set<(progress: AdventurePreloadProgress) => void>();
let latestProgress: AdventurePreloadProgress = {
  loadedBytes: 0,
  totalBytes: 0,
  finished: false,
};
let adventureRun: Promise<void> | null = null;

const emitProgress = (progress: AdventurePreloadProgress) => {
  latestProgress = progress;
  listeners.forEach((listener) => listener(progress));
};

export function subscribeAdventurePreload(
  listener: (progress: AdventurePreloadProgress) => void,
): () => void {
  listeners.add(listener);
  listener(latestProgress);
  return () => listeners.delete(listener);
}

const formatSafe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

async function readCachedBytes(cache: Cache, url: string): Promise<number | null> {
  const hit = await cache.match(url);
  if (!hit) return null;
  const header = Number(hit.headers.get('content-length'));
  if (Number.isFinite(header) && header > 0) return header;
  try {
    const blob = await hit.clone().blob();
    return blob.size;
  } catch {
    return 0;
  }
}

async function storeResponse(cache: Cache, url: string, bytes: Uint8Array, contentType: string | null) {
  const headers = new Headers();
  if (contentType) headers.set('content-type', contentType);
  headers.set('content-length', String(bytes.byteLength));
  await cache.put(url, new Response(bytes, { status: 200, headers }));
}

async function downloadOne(
  cache: Cache,
  url: string,
  onChunk: (received: number, expected: number) => void,
): Promise<void> {
  const existing = await readCachedBytes(cache, url);
  if (existing != null) {
    onChunk(existing, existing);
    if (!isVideo(url) && !/\.glb(\?|#|$)/i.test(url)) warmImage(url);
    return;
  }
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const expected = formatSafe(Number(response.headers.get('content-length')));
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    if (step.value) {
      chunks.push(step.value);
      received += step.value.byteLength;
      onChunk(received, expected || received);
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await storeResponse(cache, url, bytes, response.headers.get('content-type'));
  if (!isVideo(url) && !/\.glb(\?|#|$)/i.test(url)) warmImage(url);
}

async function islandMediaUrls(): Promise<string[]> {
  try {
    const islands = await fetchOceanMapIslands();
    if (!islands) return [];
    const urls: string[] = [];
    for (const island of islands) {
      const art = getOceanIslandArtSrc(island);
      if (art) urls.push(art);
      if (island.sailArtUrl) urls.push(island.sailArtUrl);
      if (island.mainMapUrl) urls.push(island.mainMapUrl);
      if (island.mainMapVideoUrl) urls.push(island.mainMapVideoUrl);
    }
    return urls;
  } catch {
    return [];
  }
}

/**
 * Download the parrot flights, sail background, journey art, and island
 * backgrounds. Safe to call more than once — the second call joins the first.
 */
export function startAdventurePreload(): Promise<void> {
  if (adventureRun) return adventureRun;
  adventureRun = (async () => {
    registerAssetCacheWorker();
    // Queue order is what a new family sees first: onboarding media, then the
    // crew ship they land on, then the journey map and the rest of the shell.
    const staticUrls = [
      ...ONBOARDING_MEDIA_URLS,
      ...PARROT_MODEL_URLS,
      ...CREW_SHIP_ASSET_URLS,
      ...SHELL_ASSET_URLS,
      ...SAIL_ASSET_URLS,
    ];
    const islandUrlsPromise = islandMediaUrls();
    let cache: Cache | null = null;
    try {
      cache = await caches.open(ASSET_CACHE_NAME);
    } catch {
      cache = null;
    }
    const received = new Map<string, number>();
    const expected = new Map<string, number>();
    const publish = (finished: boolean) => {
      let loadedBytes = 0;
      let totalBytes = 0;
      received.forEach((value) => {
        loadedBytes += value;
      });
      expected.forEach((value) => {
        totalBytes += value;
      });
      emitProgress({ loadedBytes, totalBytes: Math.max(totalBytes, loadedBytes), finished });
    };
    const queue = [...new Set(staticUrls)];
    const queued = new Set(queue);
    islandUrlsPromise.then((extra) => {
      for (const url of extra) {
        if (!url || queued.has(url)) continue;
        queued.add(url);
        queue.push(url);
      }
    });
    const take = async () => {
      while (queue.length) {
        const url = queue.shift();
        if (!url) continue;
        try {
          if (!cache) {
            if (!isVideo(url)) warmImage(url);
            continue;
          }
          await downloadOne(cache, url, (got, total) => {
            received.set(url, got);
            if (total > 0) expected.set(url, Math.max(expected.get(url) || 0, total));
            publish(false);
          });
        } catch {
          received.set(url, received.get(url) || 0);
        }
      }
    };
    await Promise.all([take(), take()]);
    await islandUrlsPromise;
    // Island art may have arrived after the workers drained the first list.
    if (queue.length) await Promise.all([take(), take()]);
    publish(true);
  })().catch(() => {
    emitProgress({ ...latestProgress, finished: true });
  });
  return adventureRun;
}

/** Warm the shell art, sail backgrounds, parrot models, and island art immediately. */
export function startAssetCache(): void {
  void startAdventurePreload();
}
