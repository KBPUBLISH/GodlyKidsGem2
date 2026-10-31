/** First-time voyage: ship → empty island → sail → story → treasure → drop Adam off. The ship tour waits until they come back. */

import { islandStoryProgressService } from '../services/islandStoryProgressService';
import { rewardsService } from '../services/rewardsService';
import { storyPackUnlockUxService } from '../services/storyPackUnlockUxService';
import { clearAdamTourSeen } from './adamTour';
import { getBibleMapApiRoot, resolveBibleMapMediaUrl } from './bibleMapApi';
import { beginJourneyStudy } from './journeyStudy';
import { isPlayableMainMapStory } from './mainMapStoryUnlock';
import { fetchOceanMapIslands } from './oceanMapIslands';
import { LIVING_TEST_BUILD } from './livingTestMode';

const STORAGE_KEY = 'godlykids_onboarding_journey';
export const ONBOARDING_JOURNEY_EVENT = 'gk-onboarding-journey';
export const ONBOARDING_GENESIS_VIDEO = '/assets/videos/onboarding-genesis-arrival.mp4';
export const SPLASH_BOAT_VIDEO = '/assets/videos/splash-set-sail.mp4?v=openart-1';
export const SPLASH_BOAT_POSTER = '/assets/images/splash-adventure.jpg?v=adventure-1';
export const SPLASH_CONTINUE_VIDEO = '/assets/videos/splash-adventure.mp4?v=adventure-1';
export const SPLASH_TAGLINE = '/assets/images/splash-tagline.png?v=hand-1';
export const ONBOARDING_FAMILY_BG_VIDEO = '/assets/videos/onboarding-family-bg.mp4?v=openart-3';
export const ONBOARDING_FAMILY_BG_POSTER = '/assets/images/onboarding-family-bg.jpg?v=openart-3';
/** Flame guide (kept for fallback). Perry is the live island guide. */
export const ONBOARDING_GUIDE_IMAGE = '/assets/images/onboarding-guide-spark.png';
/** Same ElevenLabs Elli voice Perry uses on the fly-in. */
export const ONBOARDING_GUIDE_VOICE_ID = 'MF3mGyEYCl7XYWbV9V6O';
/** On-screen typewriter copy (no emotion tags). */
export const ONBOARDING_GUIDE_DEFAULT_NAME = 'Godly Kids';
export const ONBOARDING_GUIDE_LINE =
  'Ahoy! Welcome Godly Kids, my name is Perry! I will be your guide and helper. Are you ready to explore the greatest stories ever told! Tap on Island !';
/** Spoken copy — ElevenLabs v4 emotion tags (stripped from the bubble). */
export const ONBOARDING_GUIDE_TTS =
  '[giggles] Ahoy! [happily] Welcome Godly Kids, [warmly] my name is Perry! [gently] I will be your guide and helper. [excitedly] Are you ready to explore the greatest stories ever told! [pause] Tap on Island !';

export type GuideBeat = {
  line: string;
  tts: string;
};

function guideFirstName(kidName?: string | null): string {
  const first = String(kidName || '')
    .trim()
    .split(/\s+/)[0];
  return first || ONBOARDING_GUIDE_DEFAULT_NAME;
}

/** Build the map-guide greeting. Uses the kid's first name when set. */
export function buildOnboardingGuideCopy(kidName?: string | null): GuideBeat {
  const name = guideFirstName(kidName);
  return {
    line: `Ahoy! Welcome ${name}, my name is Perry! I will be your guide and helper. Are you ready to explore the greatest stories ever told! Tap on Island !`,
    tts: `[giggles] Ahoy! [happily] Welcome ${name}, [warmly] my name is Perry! [gently] I will be your guide and helper. [excitedly] Are you ready to explore the greatest stories ever told! [pause] Tap on Island !`,
  };
}

const STORY_PACK_RUNDOWN_KEY = 'godlykids_story_pack_rundown_seen';

export function hasSeenStoryPackRundown(): boolean {
  try {
    return (
      localStorage.getItem(STORY_PACK_RUNDOWN_KEY) === '1' ||
      sessionStorage.getItem(STORY_PACK_RUNDOWN_KEY) === '1'
    );
  } catch {
    return false;
  }
}

/** Set once they open the story, so a return visit does not replay the tour. */
export function markStoryPackRundownSeen(): void {
  try {
    localStorage.setItem(STORY_PACK_RUNDOWN_KEY, '1');
    sessionStorage.setItem(STORY_PACK_RUNDOWN_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Spoken when they come back to the pack before the story is finished. */
export function buildStoryPackResumeBeats(kidName?: string | null): GuideBeat[] {
  const first = String(kidName || '')
    .trim()
    .split(/\s+/)[0];
  const named = first && first !== ONBOARDING_GUIDE_DEFAULT_NAME;
  return [
    {
      line: named
        ? `${first}, complete the story pack first before moving on.`
        : 'Complete the story pack first before moving on.',
      tts: named
        ? `[warmly] ${first}, [gently] complete the story pack first before moving on.`
        : '[warmly] Complete the story pack first before moving on.',
    },
  ];
}

/** Story-pack rundown — finishing a Bible story is how the ship fills up. */
export function buildStoryPackGuideBeats(kidName?: string | null): GuideBeat[] {
  const name = guideFirstName(kidName);
  return [
    {
      line: `${name}, this is a story pack.`,
      tts: `[happily] ${name}, [warmly] this is a story pack.`,
    },
    {
      line: `Completing Bible stories unlocks characters and treasures.`,
      tts: `[excitedly] Completing Bible stories unlocks characters and treasures.`,
    },
    {
      line: `Ready to get started? Tap Read Story`,
      tts: `[pause] Ready to get started? [giggles] Tap Read Story`,
    },
  ];
}

/** After the first quiz — send them to the Rewards post on the story pack. */
export function buildTapRewardGuideBeats(kidName?: string | null): GuideBeat[] {
  const name = guideFirstName(kidName);
  return [
    {
      line: `Awesome ${name}, really great job!`,
      tts: `[excitedly] Awesome ${name}, [happily] really great job!`,
    },
    {
      line: `Now tap Reward to dig up your treasure.`,
      tts: `[pause] Now tap Reward to dig up your treasure. [excitedly]`,
    },
  ];
}

/** After they dig up the treasure — invite them to meet unlocked Adam. */
export function buildQuizCompleteGuideBeats(_kidName?: string | null): GuideBeat[] {
  return [
    {
      line: `Woah! That was a good find! A game, some coins to spend in the build shop, and Adam! Let's take him to your island.`,
      tts: `[excitedly] Woah! [happily] That was a good find! [giggles] A game, some coins to spend in the build shop, and Adam! [pause] Let's take him to your island.`,
    },
  ];
}

const DISCOVER_SHIP_KEY = 'godlykids_discover_ship_pending';

/** First stop of the voyage: Perry introduces the ship, then the story pack. */
export function markDiscoverShipPending(): void {
  try {
    sessionStorage.setItem(DISCOVER_SHIP_KEY, '1');
    localStorage.setItem(DISCOVER_SHIP_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function isDiscoverShipPending(): boolean {
  try {
    return (
      sessionStorage.getItem(DISCOVER_SHIP_KEY) === '1' ||
      localStorage.getItem(DISCOVER_SHIP_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function clearDiscoverShipPending(): void {
  try {
    sessionStorage.removeItem(DISCOVER_SHIP_KEY);
    localStorage.removeItem(DISCOVER_SHIP_KEY);
  } catch {
    /* private mode */
  }
}

/** Opening lines on the crew ship. The island comes before any story. */
export function buildDiscoverShipGuideBeats(): GuideBeat[] {
  return [
    {
      line: `Here's your ship.`,
      tts: `[excitedly] Here's your ship.`,
    },
    {
      line: `Check out your own island.`,
      tts: `[happily] Check out your own island.`,
    },
  ];
}

const SAIL_FOR_STORY_KEY = 'godlykids_sail_for_story_pending';

/** Set when they leave the empty island to go get a character. */
export function markSailForStoryPending(): void {
  try {
    sessionStorage.setItem(SAIL_FOR_STORY_KEY, '1');
    localStorage.setItem(SAIL_FOR_STORY_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function isSailForStoryPending(): boolean {
  try {
    return (
      sessionStorage.getItem(SAIL_FOR_STORY_KEY) === '1' ||
      localStorage.getItem(SAIL_FOR_STORY_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function clearSailForStoryPending(): void {
  try {
    sessionStorage.removeItem(SAIL_FOR_STORY_KEY);
    localStorage.removeItem(SAIL_FOR_STORY_KEY);
  } catch {
    /* private mode */
  }
}

/** Back on the ship after the empty island: board, sail, then the story. */
export function buildSailForStoryBeats(): GuideBeat[] {
  return [
    {
      line: `Jump back on the boat.`,
      tts: `[happily] Jump back on the boat.`,
    },
    {
      line: `Let's sail, and read a story.`,
      tts: `[excitedly] Let's sail, and read a story.`,
    },
  ];
}

/** Later visit, after the first treasure, with Adam on deck. */
export function buildCrewShipGuideBeats(): GuideBeat[] {
  return [
    {
      line: `This is your crew ship!`,
      tts: `[excitedly] This is your crew ship!`,
    },
    {
      line: `And your first crew mate, Adam.`,
      tts: `[happily] And your first crew mate, Adam.`,
    },
    {
      line: `Tap him! He knows this ship inside out and he'll show you around.`,
      tts: `[excitedly] Tap him! [warmly] He knows this ship inside out and he'll show you around.`,
    },
  ];
}

/** First tap of Library on the ship deck. */
export function buildLibraryGuideBeats(): GuideBeat[] {
  return [
    {
      line: `Hey hey adventurer, looks like you found the ship's epic Library!`,
      tts: `[giggles] Hey hey adventurer, [happily] looks like you found the ship's epic Library!`,
    },
    {
      line: `The ship's Library is expanding all the time with amazing books and audio stories made by Christians like you.`,
      tts: `[warmly] The ship's Library is expanding all the time with amazing books and audio stories made by Christians like you.`,
    },
    {
      line: `Go ahead, tap one to explore!`,
      tts: `[excitedly] Go ahead, tap one to explore!`,
    },
  ];
}

const LIBRARY_HS_KEY = 'godlykids_library_hs_guide';

export function hasSeenLibraryHsGuide(): boolean {
  try {
    return localStorage.getItem(LIBRARY_HS_KEY) === '1' || sessionStorage.getItem(LIBRARY_HS_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLibraryHsGuideSeen(): void {
  try {
    localStorage.setItem(LIBRARY_HS_KEY, '1');
    sessionStorage.setItem(LIBRARY_HS_KEY, '1');
  } catch {
    /* private mode */
  }
}

function writeJourneyFlag(value: boolean): void {
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* private mode */
  }
}

function isGuestOnboarding(): boolean {
  try {
    if (localStorage.getItem('godlykids_auth_token')) return false;
    if (localStorage.getItem('godlykids_user_email')) return false;
  } catch {
    /* private mode */
  }
  return true;
}

/** Device-local progress from a previous guest run (no account) must not skip story pack 1. */
function resetGuestPlayProgress(): void {
  if (!isGuestOnboarding()) return;
  islandStoryProgressService.clearAllLocal();
  storyPackUnlockUxService.clearAllLocal();
  rewardsService.resetLocal();
  clearAdamTourSeen();
  try {
    localStorage.removeItem('godlykids_library_hs_guide');
    sessionStorage.removeItem('godlykids_library_hs_guide');
    localStorage.removeItem(STORY_PACK_RUNDOWN_KEY);
    sessionStorage.removeItem(STORY_PACK_RUNDOWN_KEY);
    localStorage.removeItem(DISCOVER_SHIP_KEY);
    sessionStorage.removeItem(DISCOVER_SHIP_KEY);
    localStorage.removeItem(SAIL_FOR_STORY_KEY);
    sessionStorage.removeItem(SAIL_FOR_STORY_KEY);
    localStorage.removeItem('godlykids_ship_tour_pending_v1');
    sessionStorage.removeItem('godlykids_ship_tour_pending_v1');
    localStorage.removeItem('godlykids_ships_library_paywall_seen');
    sessionStorage.removeItem('godlykids_ships_library_paywall_seen');
    localStorage.removeItem('godlykids_free_library_story_id');
    sessionStorage.removeItem('godlykids_free_library_story_id');
    localStorage.removeItem('godlykids_last_story_island');
    sessionStorage.removeItem('godlykids_last_story_island');
  } catch {
    /* private mode */
  }
}

export function startOnboardingJourney(): void {
  beginJourneyStudy();
  resetGuestPlayProgress();
  writeJourneyFlag(true);
  window.dispatchEvent(new Event(ONBOARDING_JOURNEY_EVENT));
  // The ship is the next stop — make sure its art is warming (dynamic import:
  // assetPreloader → assetCache imports this module, so no static cycle).
  void import('./assetPreloader').then((m) => m.preloadCrewPageAssets()).catch(() => {});
}

export function isOnboardingJourneyActive(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1' || localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function completeOnboardingJourney(): void {
  writeJourneyFlag(false);
  window.dispatchEvent(new Event(ONBOARDING_JOURNEY_EVENT));
}

export function subscribeOnboardingJourney(listener: () => void): () => void {
  window.addEventListener(ONBOARDING_JOURNEY_EVENT, listener);
  return () => window.removeEventListener(ONBOARDING_JOURNEY_EVENT, listener);
}

type PackStory = {
  _id: string;
  order?: number;
  title?: string;
  displayTitle?: string;
  heroImageUrl?: string;
  status?: string;
};

/** Where "let me show you how" lands: the first island's first story pack. */
export async function resolveFirstStoryPackDestination(): Promise<{
  path: string;
  state: Record<string, unknown>;
}> {
  const islands = await fetchOceanMapIslands().catch(() => null);
  const first = islands?.find((island) => island.status !== 'locked') || islands?.[0];
  if (!first) {
    if (LIVING_TEST_BUILD) throw new Error('Stories are taking a moment. Please try again.');
    return { path: '/map', state: { onboardingJourney: true } };
  }

  try {
    const res = await fetch(
      `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(first.id)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { stories?: PackStory[] };
      const pack = (Array.isArray(data.stories) ? data.stories : [])
        .filter((story): story is PackStory => Boolean(story && story._id))
        .filter((story) => isPlayableMainMapStory(story))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      if (pack?._id) {
        const title = pack.displayTitle || pack.title || first.title;
        return {
          path: `/sail/${encodeURIComponent(first.id)}/lesson?storyId=${encodeURIComponent(pack._id)}`,
          state: {
            onboardingJourney: true,
            title,
            heroImageUrl: resolveBibleMapMediaUrl(pack.heroImageUrl) || undefined,
          },
        };
      }
    }
  } catch {
    /* sail deck still gets them onto the island */
  }

  if (LIVING_TEST_BUILD) throw new Error('The first story pack is not ready. Please try again.');
  return {
    path: `/sail/${encodeURIComponent(first.id)}`,
    state: {
      onboardingJourney: true,
      title: `${first.book}: ${first.title}`,
      hasMainMap: Boolean(first.mainMapUrl || first.mainMapVideoUrl),
      mainMapUrl: first.mainMapUrl,
      mainMapVideoUrl: first.mainMapVideoUrl,
    },
  };
}
