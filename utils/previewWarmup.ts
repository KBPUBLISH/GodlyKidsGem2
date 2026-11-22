import { createAssetWarmupQueue } from './assetWarmupQueue.mjs';
import { previewWarmupAssets } from './previewAssets.mjs';
import { getFirstStoryIslandArt } from './previewIslandCatalogue';

const queue = createAssetWarmupQueue(async (url: string, signal: AbortSignal) => {
  // Share the existing media cache even if the service worker has not taken control yet.
  const cache = await window.caches?.open('godlykids-images-v1').catch(() => undefined);
  if (await cache?.match(url)) return;
  const response = await fetch(url, {signal, priority: 'low'} as RequestInit);
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return;
  const copy = response.clone();
  await response.arrayBuffer();
  if (!signal.aborted) await cache?.put(url, copy).catch(() => {});
});
let generation = 0;

/** Start on the splash; keep useful downloads running through language and onboarding. */
export function warmPreviewNextScreen(screen: 'onboarding' | 'ship' | 'island'): () => void {
  const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
  const current = ++generation;
  if (screen === 'island') queue.start(previewWarmupAssets(screen, connection));
  else {
    // Begin small screen artwork immediately. Do not let models get ahead of
    // the destination image while its tiny manifest is still arriving.
    queue.start(previewWarmupAssets(screen, connection).filter(url => !url.includes('.glb')));
    void getFirstStoryIslandArt().then(firstIslandArt => {
      if (generation !== current) return;
      queue.start(previewWarmupAssets(screen, connection, firstIslandArt));
    });
  }
  // Screen changes must not throw away an in-flight island download.
  return () => {};
}

export const subscribePreviewWarmup = queue.subscribe;
/** The real island takes priority once the child enters it. */
export function stopPreviewWarmup() {
  generation++;
  queue.stop();
}
