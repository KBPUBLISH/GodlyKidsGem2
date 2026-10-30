/** Stable URLs shared by early HTML hints, the screens, and background warmup. */
export const PREVIEW_ART = {
  splash: '/assets/images/splash-adventure-mobile-v1.webp',
  logo: '/assets/images/godly-kids-logo-mobile-v1.webp',
  languageOcean: '/assets/images/language/language-ocean-mobile-v1.webp',
  languageGlobe: '/assets/images/language/language-globe-mobile-v1.webp',
};

const language = [PREVIEW_ART.languageOcean, PREVIEW_ART.languageGlobe];
const onboarding = [
  '/assets/images/pass-phone-parent-hand.png', '/assets/images/pass-phone-kid-hand.png',
  '/assets/images/onboarding-family-bg.jpg?v=openart-3', '/models/mobile/perry-flight.glb?v=1',
];
const ship = [
  '/assets/images/crew-voyage-sea-pano.webp?v=1', '/assets/images/sail-voyage-hull.webp?v=1',
  '/assets/images/crew-voyage-bow.webp?v=1', '/assets/images/sail-voyage-wheel.webp?v=1',
];
const island = ['environment', 'library', 'construction', 'house-upgrades', 'wood-storage', 'church']
  .map(name => `/homeworld/assets/mobile/${name}.glb?v=mobile-1`);

export function previewWarmupAssets(screen, connection = {}) {
  // Tiny next-screen artwork is still useful on a limited connection.
  if (connection.saveData || /2g|3g/.test(connection.effectiveType || '')) {
    return screen === 'onboarding' ? language : [];
  }
  if (screen === 'onboarding') return [...language, ...onboarding, ...ship, ...island];
  if (screen === 'ship') return [...ship, ...island];
  return island;
}
