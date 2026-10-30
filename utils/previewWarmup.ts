import { createAssetWarmupQueue } from './assetWarmupQueue.mjs';
import { previewWarmupAssets } from './previewAssets.mjs';

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

/** Start on the splash; keep useful downloads running through language and onboarding. */
export function warmPreviewNextScreen(screen: 'onboarding' | 'ship' | 'island'): () => void {
  const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
  queue.start(previewWarmupAssets(screen, connection));
  // Screen changes must not throw away an in-flight island download.
  return () => {};
}

export const subscribePreviewWarmup = queue.subscribe;
/** The real island takes priority once the child enters it. */
export const stopPreviewWarmup = queue.stop;
