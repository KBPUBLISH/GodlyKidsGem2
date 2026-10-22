/** First-time guided sail: crew setup → journey map → first island → first story pack. */

import { islandStoryProgressService } from '../services/islandStoryProgressService';
import { rewardsService } from '../services/rewardsService';
import { storyPackUnlockUxService } from '../services/storyPackUnlockUxService';
import { clearAdamTourSeen } from './adamTour';
import { beginJourneyStudy } from './journeyStudy';

const STORAGE_KEY = 'godlykids_onboarding_journey';
export const ONBOARDING_JOURNEY_EVENT = 'gk-onboarding-journey';
export const ONBOARDING_GENESIS_VIDEO = '/assets/videos/onboarding-genesis-arrival.mp4';
export const SPLASH_BOAT_VIDEO = '/assets/videos/splash-set-sail.mp4?v=openart-1';
export const SPLASH_BOAT_POSTER = '/assets/images/splash-set-sail.jpg?v=openart-1';
export const SPLASH_CONTINUE_VIDEO = '/assets/videos/splash-continue.mp4?v=openart-1';
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
