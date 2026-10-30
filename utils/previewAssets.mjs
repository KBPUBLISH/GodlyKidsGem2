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
  '/assets/images/onboarding-family-bg.jpg?v=openart-3',
];
/** The crew screen and its preloader share exact URLs, including cache revisions. */
export const PREVIEW_SHIP_ART = {
  sky: '/assets/images/crew-voyage-sea-pano.webp?v=1',
  hull: '/assets/images/sail-voyage-hull.webp?v=1',
  bow: '/assets/images/crew-voyage-bow.webp?v=1',
  wheel: '/assets/images/sail-voyage-wheel.webp?v=1',
  crew: '/assets/images/sail-voyage-tab-crew.webp?v=1',
  profile: '/assets/images/sail-voyage-tab-profile.webp?v=1',
  home: '/assets/images/sail-voyage-tab-home.webp?v=2',
  library: '/assets/images/sail-voyage-tab-library.webp?v=1',
  plank: '/assets/images/crew-button-plank.webp?v=1',
  tabWood: '/assets/images/sail-tab-wood.webp?v=1',
  wood: '/assets/images/wheel-background-wood.webp',
  hatch: '/assets/images/crew-voyage-hatch.webp?v=1',
  cloudA: '/assets/images/map-sky-cloud-a-mobile-v1.webp',
  cloudB: '/assets/images/map-sky-cloud-b-mobile-v1.webp',
  horizonA: '/assets/images/crew-horizon-island-a.webp?v=1',
  horizonB: '/assets/images/crew-horizon-island-b.webp?v=1',
};
const ship = Object.values(PREVIEW_SHIP_ART);
const parrot = '/models/mobile/perry-flight.glb?v=1';
const island = ['environment', 'library', 'construction', 'house-upgrades', 'wood-storage', 'church']
  .map(name => `/homeworld/assets/mobile/${name}.glb?v=mobile-1`);

export function previewWarmupAssets(screen, connection = {}, firstIslandArt) {
  const limited = connection.saveData || /2g|3g/.test(connection.effectiveType || '');
  const destination = firstIslandArt ? [firstIslandArt, ...ship] : ship;
  // Essential upcoming UI should still warm on cellular. Only large models wait.
  if (screen === 'onboarding') return [...language, ...onboarding, ...destination, ...(limited ? [] : [parrot, ...island])];
  if (screen === 'ship') return [...destination, ...(limited ? [] : island)];
  return limited ? [] : island;
}
