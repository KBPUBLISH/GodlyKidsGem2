/** Warm only the next screen. Cancel when navigation makes the work obsolete. */
export function warmPreviewNextScreen(screen: 'onboarding' | 'ship' | 'island'): () => void {
  const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
  if (connection?.saveData || /2g|3g/.test(connection?.effectiveType || '')) return () => {};
  const urls = screen === 'onboarding' ? [
    '/assets/images/pass-phone-parent-hand.png', '/assets/images/pass-phone-kid-hand.png',
    '/models/mobile/perry-flight.glb?v=1',
  ] : screen === 'ship' ? [
    '/assets/images/crew-voyage-sea-pano.webp?v=1', '/assets/images/sail-voyage-hull.webp?v=1',
    '/assets/images/crew-voyage-bow.webp?v=1', '/assets/images/sail-voyage-wheel.webp?v=1',
  ] : ['environment', 'library', 'construction', 'house-upgrades', 'wood-storage', 'church']
    .map(name => `/homeworld/assets/mobile/${name}.glb?v=mobile-1`);
  const controller = new AbortController();
  const timer = window.setTimeout(async () => {
    for (const url of urls) {
      if (controller.signal.aborted) return;
      try {
        const response = await fetch(url, {signal: controller.signal, priority: 'low'} as RequestInit);
        if (response.ok) await response.arrayBuffer();
      } catch { /* the actual screen can retry when needed */ }
    }
  }, 2000);
  return () => { window.clearTimeout(timer); controller.abort(); };
}
