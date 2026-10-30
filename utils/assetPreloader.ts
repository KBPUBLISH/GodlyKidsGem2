/**
 * First-launch background preloader for the crew ship deck (#/crew).
 *
 * The ship page is heavy: a 5 MB hull painting, 3 MB bow, four ~1 MB nav
 * tiles, the wheel, Adam's Draco GLB plus the Draco decoder, the ~600 KB
 * three.js chunk, and the CMS island paintings on the horizon. On a fresh
 * install the kid reaches the ship a few screens in, so we fetch all of
 * that quietly while they are still on the splash / onboarding.
 *
 * Fetched files land in the same Cache API bucket the media service worker
 * (`public/sw-image-cache.js`) serves cache-first, and in the HTTP cache
 * (see `netlify.toml` Cache-Control rules) for the Despia webview where a
 * service worker may not be available.
 *
 * Runs once per install per MANIFEST_VERSION (bump it to re-warm after an
 * art change), waits for idle, never throws, and skips the heavy tier on
 * save-data / 2g / 3g connections.
 */
import { ASSET_CACHE_NAME } from './assetCache';
import { LIVING_TEST_BUILD } from './livingTestMode';
import { getOnDeckCrew } from '../services/rewardsService';
import { fetchOceanMapIslands, getSailIslandArtSrc } from './oceanMapIslands';

/** Bump when the crew art set changes so existing installs re-warm. */
const MANIFEST_VERSION = 1;
const DONE_FLAG = `gk_crew_assets_preloaded_v${MANIFEST_VERSION}`;

/** Fetch at most this many files at once — the user is still using the app. */
const CONCURRENCY = 2;
/** Give the first screen time to paint and settle before we start. */
const START_DELAY_MS = 2500;
/** Anything at or above this is "heavy": fetched last, skipped on slow links. */
const HEAVY_BYTES = 10 * 1024 * 1024;

/** Static crew-page images (keep the `?v=` busters in sync with CrewPage). */
const CREW_IMAGE_URLS = [
  '/assets/images/crew-voyage-sea-pano.webp?v=1',
  '/assets/images/sail-voyage-hull.webp?v=1',
  '/assets/images/sail-voyage-wheel.webp?v=1',
  '/assets/images/crew-voyage-bow.webp?v=1',
  '/assets/images/sail-voyage-tab-crew.webp?v=1',
  '/assets/images/sail-voyage-tab-profile.webp?v=1',
  '/assets/images/sail-voyage-tab-home.webp?v=2',
  '/assets/images/sail-voyage-tab-library.webp?v=1',
  '/assets/images/crew-voyage-hatch.webp?v=1',
  '/assets/images/wheel-background-wood.png',
  '/assets/images/sail-tab-wood.webp?v=1',
  // Crew picker (bottom "Crew" tile) and the guide cards.
  '/assets/images/crew-ship-deck-bg.png',
];

/** Adam — the first crew member every install gets (Draco-compressed GLB). */
const ADAM_MODEL_URL = '/models/test-character.glb';
/** Draco decoder the GLTFLoader fetches for compressed models. */
const DRACO_URLS = ['/draco/draco_wasm_wrapper.js', '/draco/draco_decoder.wasm'];
/** Known large models (>10 MB) — only on a good connection, and last. */
const KNOWN_HEAVY = [/\/models\/noah-/i];

type Tier = 'chunk' | 'image' | 'model' | 'audio' | 'heavy' | 'video';

type Item = { url: string; tier: Tier };

type Summary = {
  fetched: number;
  cached: number;
  skipped: number;
  failed: number;
  bytes: number;
  ms: number;
};

let run: Promise<Summary | null> | null = null;

const isDev = (): boolean => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
};

const log = (...args: unknown[]) => {
  if (isDev()) console.info('[crewPreload]', ...args);
};

const onCrewPage = (): boolean =>
  typeof window !== 'undefined' && /^#\/crew(\/|\?|$)/.test(window.location.hash || '');

const readFlag = (): boolean => {
  try {
    return localStorage.getItem(DONE_FLAG) === '1';
  } catch {
    return false;
  }
};

const writeFlag = () => {
  try {
    localStorage.setItem(DONE_FLAG, '1');
  } catch {
    /* private mode — we'll just re-run next launch; cache hits make it cheap */
  }
};

type NetInfo = { saveData?: boolean; effectiveType?: string };

/** True on save-data or a 2g/3g link — skip the heavy tier. */
const slowNetwork = (): boolean => {
  const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return /(^|-)(2g|3g)$/.test(String(conn.effectiveType || ''));
};

const whenIdle = (): Promise<void> =>
  new Promise((resolve) => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(() => resolve(), { timeout: 4000 });
    } else {
      window.setTimeout(resolve, 200);
    }
  });

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

const isHeavyUrl = (url: string) => KNOWN_HEAVY.some((re) => re.test(url));

/** Per-character GLBs from the kid's roster (Adam is always included). */
const crewModelItems = (): Item[] => {
  const urls = new Set<string>([ADAM_MODEL_URL]);
  try {
    getOnDeckCrew().forEach((c) => {
      const u = (c.modelUrl || '').trim();
      if (u) urls.add(u);
    });
  } catch {
    /* rewards store unreadable — Adam alone is still worth warming */
  }
  return [...urls].map((url) => ({ url, tier: isHeavyUrl(url) ? 'heavy' : 'model' }));
};

/** CMS island paintings shown on the horizon (first three are visible). */
const islandArtItems = async (): Promise<Item[]> => {
  try {
    const islands = await fetchOceanMapIslands();
    if (!islands) return [];
    const urls = new Set<string>();
    for (const island of islands.slice(0, 5)) {
      const src = getSailIslandArtSrc(island);
      if (src) urls.add(src);
    }
    return [...urls].map((url) => ({ url, tier: 'image' as Tier }));
  } catch {
    return [];
  }
};

const byteLength = async (res: Response): Promise<number> => {
  const header = Number(res.headers.get('content-length'));
  if (Number.isFinite(header) && header > 0) return header;
  try {
    return (await res.clone().blob()).size;
  } catch {
    return 0;
  }
};

/** Fetch one URL into the shared Cache API bucket (and the HTTP cache). */
async function fetchOne(
  cache: Cache | null,
  item: Item,
  summary: Summary,
): Promise<void> {
  const { url } = item;
  try {
    if (cache) {
      const hit = await cache.match(url);
      if (hit) {
        summary.cached += 1;
        return;
      }
    }
    const init: RequestInit & { priority?: 'low' | 'high' | 'auto' } = {
      credentials: 'omit',
      priority: 'low',
    };
    if (!url.startsWith('/')) init.mode = 'cors';
    const res = await fetch(url, init);
    if (!res.ok && res.type !== 'opaque') throw new Error(`HTTP ${res.status}`);
    const bytes = await byteLength(res);
    if (cache && (res.status === 200 || res.type === 'opaque')) {
      try {
        await cache.put(url, res.clone());
      } catch {
        /* quota — the HTTP cache still has it */
      }
    }
    summary.fetched += 1;
    summary.bytes += bytes;
  } catch (err) {
    summary.failed += 1;
    log('failed', url, err);
  }
}

async function runQueue(cache: Cache | null, items: Item[], summary: Summary): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      if (onCrewPage()) {
        // The page is loading these itself now — don't compete for bandwidth.
        summary.skipped += queue.length;
        queue.length = 0;
        return;
      }
      const item = queue.shift();
      if (!item) return;
      await fetchOne(cache, item, summary);
    }
  });
  await Promise.all(workers);
}

async function preload(): Promise<Summary | null> {
  if (typeof window === 'undefined') return null;
  if (readFlag()) return null;
  if (onCrewPage()) return null; // already there; the page loads its own art

  await sleep(START_DELAY_MS);
  await whenIdle();
  if (onCrewPage() || readFlag()) return null;

  const started = performance.now();
  const summary: Summary = { fetched: 0, cached: 0, skipped: 0, failed: 0, bytes: 0, ms: 0 };
  const slow = slowNetwork();

  let cache: Cache | null = null;
  try {
    if ('caches' in window) cache = await caches.open(ASSET_CACHE_NAME);
  } catch {
    cache = null;
  }

  // 1. three.js deck chunk (lazy route piece of /crew). Vite resolves this to
  //    the same hashed file CrewPage's React.lazy() imports.
  if (!slow) {
    try {
      await import('../components/crew/CrewDeck3D');
      summary.fetched += 1;
    } catch (err) {
      summary.failed += 1;
      log('chunk failed', err);
    }
  } else {
    summary.skipped += 1;
  }

  // 2. Images (static art first, then CMS island paintings).
  const islandItems = islandArtItems(); // network — overlaps with the static set
  await runQueue(cache, CREW_IMAGE_URLS.map((url) => ({ url, tier: 'image' as Tier })), summary);
  await runQueue(cache, await islandItems, summary);

  // 3. Models: Draco decoder + light GLBs, heavy ones last.
  const models = crewModelItems();
  await runQueue(cache, DRACO_URLS.map((url) => ({ url, tier: 'model' as Tier })), summary);
  await runQueue(cache, models.filter((m) => m.tier !== 'heavy'), summary);

  // 4. Audio — the jukebox is parked (JUKEBOX_ENABLED=false); nothing to warm.
  // 5. Heavy tier (≥10 MB models; no video on the crew page). Skipped on
  //    save-data / 2g / 3g — the ship still works, Noah just streams in later.
  const heavy = models.filter((m) => m.tier === 'heavy');
  if (slow) {
    summary.skipped += heavy.length;
  } else {
    await runQueue(cache, heavy, summary);
  }

  summary.ms = Math.round(performance.now() - started);
  // Only remember a run that finished with nothing left to do; an interrupted
  // or failed run tries again next launch (cache hits keep that cheap).
  if (summary.skipped === 0 && summary.failed === 0) writeFlag();
  log(
    `${summary.fetched} fetched, ${summary.cached} already cached, ${summary.skipped} skipped, ` +
      `${summary.failed} failed — ${(summary.bytes / 1024 / 1024).toFixed(1)} MB in ${summary.ms} ms` +
      (slow ? ' (slow network: heavy tier skipped)' : ''),
  );
  return summary;
}

/**
 * Warm the crew ship deck's art, models, and 3D chunk in the background.
 * Safe to call from several places — the first call starts the run, the
 * rest join it. Never rejects.
 */
export function preloadCrewPageAssets(): Promise<Summary | null> {
  if (LIVING_TEST_BUILD) return Promise.resolve(null);
  if (!run) {
    run = preload().catch((err) => {
      log('aborted', err);
      return null;
    });
  }
  return run;
}

/** Dev / QA: forget the once-per-install flag so the next launch re-warms. */
export function resetCrewPreloadFlag(): void {
  try {
    localStorage.removeItem(DONE_FLAG);
  } catch {
    /* ignore */
  }
}
