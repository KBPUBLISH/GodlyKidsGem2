/** First-time guided sail: crew setup → journey map → first island → first story pack. */

import { islandStoryProgressService } from '../services/islandStoryProgressService';
import { rewardsService } from '../services/rewardsService';

const STORAGE_KEY = 'godlykids_onboarding_journey';
export const ONBOARDING_JOURNEY_EVENT = 'gk-onboarding-journey';
export const ONBOARDING_GENESIS_VIDEO = '/assets/videos/onboarding-genesis-arrival.mp4';
/** Flame guide on the first-time journey map. */
export const ONBOARDING_GUIDE_IMAGE = '/assets/images/onboarding-guide-spark.png';
/** Portal ElevenLabs voice "HS". */
export const ONBOARDING_GUIDE_VOICE_ID = 'nzq834KPTCJtG39LGkdi';
/** On-screen typewriter copy (no emotion tags). */
export const ONBOARDING_GUIDE_DEFAULT_NAME = 'Godly Kids';
export const ONBOARDING_GUIDE_LINE =
  'Ahoy! Welcome Godly Kids, my name is HS! I will be your guide and helper. Are you ready to explore the greatest stories ever told! Tap on Island !';
/** Spoken copy — ElevenLabs v3 emotion tags (stripped from the bubble). */
export const ONBOARDING_GUIDE_TTS =
  '[giggles] Ahoy! [happily] Welcome Godly Kids, [warmly] my name is HS! [gently] I will be your guide and helper. [excitedly] Are you ready to explore the greatest stories ever told! [pause] Tap on Island !';

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
    line: `Ahoy! Welcome ${name}, my name is HS! I will be your guide and helper. Are you ready to explore the greatest stories ever told! Tap on Island !`,
    tts: `[giggles] Ahoy! [happily] Welcome ${name}, [warmly] my name is HS! [gently] I will be your guide and helper. [excitedly] Are you ready to explore the greatest stories ever told! [pause] Tap on Island !`,
  };
}

/** Story-pack rundown — short beats so the bubble stays readable. */
export function buildStoryPackGuideBeats(kidName?: string | null): GuideBeat[] {
  const name = guideFirstName(kidName);
  return [
    {
      line: `Ok ${name}, so here is the run down.`,
      tts: `[happily] Ok ${name}, [excitedly] so here is the run down.`,
    },
    {
      line: `This is called a story pack.`,
      tts: `This is called a story pack.`,
    },
    {
      line: `You can interact and learn things by tapping on buttons on the background.`,
      tts: `[warmly] You can interact and learn things by tapping on buttons on the background.`,
    },
    {
      line: `Learn about true stories from the Bible personalized for you.`,
      tts: `[happily] Learn about true stories from the Bible personalized for you.`,
    },
    {
      line: `And even unlock fun games, and characters to add to your crew!`,
      tts: `[excitedly] And even unlock fun games, and characters to add to your crew!`,
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
      line: `Woah! That was a good find! A game, some coins to spend in the build shop, and a new Character! You wanna go meet him? Let's go!`,
      tts: `[excitedly] Woah! [happily] That was a good find! [giggles] A game, some coins to spend in the build shop, and a new Character! [pause] You wanna go meet him? [excitedly] Let's go!`,
    },
  ];
}

/** First visit to the crew ship with Adam on deck. */
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
      line: `You can talk to him, ask as many questions as you like.`,
      tts: `[warmly] You can talk to him, ask as many questions as you like.`,
    },
    {
      line: `And if you get bored with him you can collect more crew by completing story packs.`,
      tts: `[chuckles] And if you get bored with him you can collect more crew by completing story packs.`,
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
  rewardsService.resetLocal();
  try {
    localStorage.removeItem('godlykids_library_hs_guide');
    sessionStorage.removeItem('godlykids_library_hs_guide');
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
  resetGuestPlayProgress();
  writeJourneyFlag(true);
  window.dispatchEvent(new Event(ONBOARDING_JOURNEY_EVENT));
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
