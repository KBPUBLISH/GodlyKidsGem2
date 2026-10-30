/**
 * Adam's first-tap ship tour. The first time a kid taps Adam on the crew
 * ship he plays tour guide instead of opening chat: he walks the deck
 * feature by feature, climbs down the hatch, and finishes in the basement
 * pointing at the games and the Library. Runs once per device.
 */

import { ONBOARDING_ADAM_ID, type UnlockedCharacter } from '../services/rewardsService';

const TOUR_KEY = 'godlykids_adam_tour_v1';
/** Armed when Adam is dropped on the island. The ship tour plays the next time they board. */
export const SHIP_TOUR_PENDING_KEY = 'godlykids_ship_tour_pending_v1';

/** Onboarding Adam voice — used when a CMS Adam has no voice of his own. */
export const ADAM_TOUR_FALLBACK_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export const isAdamCharacter = (c: UnlockedCharacter): boolean =>
  c.id === ONBOARDING_ADAM_ID || /adam/i.test(c.name || '') || /adam/i.test(c.id || '');

export function hasSeenAdamTour(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1' || sessionStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

/** Skip Adam's tour should open the free-book challenge, not the old create-account step. */
export function dismissLegacyTutorialForChallenge(): void {
  try {
    localStorage.setItem('godlykids_tutorial_complete', 'true');
    localStorage.removeItem('godlykids_tutorial_step');
  } catch {
    /* private mode */
  }
}

export function markAdamTourSeen(): void {
  try {
    localStorage.setItem(TOUR_KEY, '1');
    sessionStorage.setItem(TOUR_KEY, '1');
    localStorage.removeItem(SHIP_TOUR_PENDING_KEY);
    sessionStorage.removeItem(SHIP_TOUR_PENDING_KEY);
  } catch {
    /* private mode */
  }
}

/** Adam lives on the island now. The next ordinary visit to the ship plays his tour. */
export function markShipTourPending(): void {
  try {
    if (localStorage.getItem(TOUR_KEY) === '1' || sessionStorage.getItem(TOUR_KEY) === '1') return;
    localStorage.setItem(SHIP_TOUR_PENDING_KEY, '1');
    sessionStorage.setItem(SHIP_TOUR_PENDING_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function isShipTourPending(): boolean {
  try {
    if (localStorage.getItem(TOUR_KEY) === '1' || sessionStorage.getItem(TOUR_KEY) === '1') return false;
    return (
      localStorage.getItem(SHIP_TOUR_PENDING_KEY) === '1' ||
      sessionStorage.getItem(SHIP_TOUR_PENDING_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function clearAdamTourSeen(): void {
  try {
    localStorage.removeItem(TOUR_KEY);
    sessionStorage.removeItem(TOUR_KEY);
    localStorage.removeItem(SHIP_TOUR_PENDING_KEY);
    sessionStorage.removeItem(SHIP_TOUR_PENDING_KEY);
    localStorage.removeItem(TOUR_WRAP_PENDING_KEY);
    localStorage.removeItem(TOUR_WRAP_DONE_KEY);
    localStorage.removeItem(TOUR_FINALE_KEY);
  } catch {
    /* private mode */
  }
}

/** Set when the first tour sends them into the library. Cleared after the wrap-up. */
const TOUR_WRAP_PENDING_KEY = 'godlykids_adam_tour_wrap_pending_v1';
const TOUR_WRAP_DONE_KEY = 'godlykids_adam_tour_wrap_done_v1';
/** One-time closer: library back → Adam's last lines → paywall. Independent of an older wrap-done flag. */
const TOUR_FINALE_KEY = 'godlykids_adam_finale_v1';

export function isAdamFinaleDone(): boolean {
  try {
    return localStorage.getItem(TOUR_FINALE_KEY) === '1';
  } catch {
    return false;
  }
}

/** A new ship tour gets its own closing offer, even if an older wrap already finished. */
export function resetAdamTourWrap(): void {
  try {
    localStorage.removeItem(TOUR_WRAP_PENDING_KEY);
    localStorage.removeItem(TOUR_WRAP_DONE_KEY);
    localStorage.removeItem(TOUR_FINALE_KEY);
  } catch {
    /* private mode */
  }
}

export function markTourWrapPending(): void {
  try {
    if (localStorage.getItem(TOUR_FINALE_KEY) === '1') return;
    localStorage.setItem(TOUR_WRAP_PENDING_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Library send-off from this tour. Clears a stale "already finished" lock so the return can play. */
export function armTourWrapFromLibrary(): void {
  try {
    if (localStorage.getItem(TOUR_FINALE_KEY) === '1') return;
    localStorage.removeItem(TOUR_WRAP_DONE_KEY);
    localStorage.setItem(TOUR_WRAP_PENDING_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function isTourWrapPending(): boolean {
  try {
    return (
      localStorage.getItem(TOUR_WRAP_PENDING_KEY) === '1' &&
      localStorage.getItem(TOUR_WRAP_DONE_KEY) !== '1'
    );
  } catch {
    return false;
  }
}

export function markTourWrapDone(): void {
  try {
    localStorage.setItem(TOUR_WRAP_DONE_KEY, '1');
    localStorage.setItem(TOUR_FINALE_KEY, '1');
    localStorage.removeItem(TOUR_WRAP_PENDING_KEY);
  } catch {
    /* private mode */
  }
}

/** Closing lines when they come back from the library to the ship. */
export function buildAdamTourWrap(kidName?: string | null): TourBeat[] {
  const name = firstName(kidName);
  const who = name ? `, ${name}` : '';
  return [
    {
      id: 'wrap',
      line: `That's it for the tour${who}! There's way more to discover on this ship.`,
      tts: `[warmly] That's it for the tour${who}! [excitedly] There's way more to discover on this ship.`,
    },
    {
      id: 'offer',
      line: 'And hey — check out this amazing offer. Finish 7 story packs in 7 days and you get a free book!',
      tts: '[excitedly] And hey, check out this amazing offer. Finish 7 story packs in 7 days, and you get a free book!',
    },
  ];
}

/** Shown on the ship after they skip the free trial. */
export function buildAdamSkipTrial(kidName?: string | null): TourBeat[] {
  const name = firstName(kidName);
  const who = name ? `, ${name}` : '';
  return [
    {
      id: 'skip-trial',
      line: `That's okay${who}! I'll be right here on the ship. You can start the free trial whenever you're ready.`,
      tts: `[warmly] That's okay${who}! [happily] I'll be right here on the ship. [gently] You can start the free trial whenever you're ready.`,
    },
  ];
}

export type TourBeat = {
  id: string;
  /** On-screen typewriter copy (no emotion tags). */
  line: string;
  /** Spoken copy — ElevenLabs emotion tags allowed. */
  tts: string;
};

/** Lock summary the pages already compute (basementGameLocks). */
export type TourLock = { locked: boolean; islandLabel: string };

const firstName = (kidName?: string | null): string | null => {
  const first = String(kidName || '')
    .trim()
    .split(/\s+/)[0];
  return first || null;
};

const unlockLine = (lock: TourLock, playLine: string): string =>
  lock.locked ? `It's locked for now — finish ${lock.islandLabel} and it's yours!` : playLine;

/** Top deck: hello → jukebox → door → home → crew → profile → library → journey → hatch. */
export function buildAdamDeckTour(kidName: string | null | undefined): TourBeat[] {
  const name = firstName(kidName);
  const hello = name ? `Hi ${name}!` : 'Hi there!';
  return [
    {
      id: 'hello',
      line: `${hello} I'm Adam, your very first crew mate. Welcome aboard! Come on, let me show you around the ship. Lots of things here unlock as you finish story packs.`,
      tts: `[happily] ${hello} [warmly] I'm Adam, your very first crew mate. [excitedly] Welcome aboard! Come on, let me show you around the ship. [warmly] Lots of things here unlock as you finish story packs.`,
    },
    {
      id: 'jukebox',
      line: `This is the jukebox. Tap it and the whole crew throws a dance party!`,
      tts: `[playfully] This is the jukebox. [excitedly] Tap it and the whole crew throws a dance party!`,
    },
    {
      id: 'door',
      line: `That door at the front of the ship is the Builder Shop. Spend the coins you dig up to dress up your very own avatar!`,
      tts: `[happily] That door at the front of the ship is the Builder Shop. [excitedly] Spend the coins you dig up to dress up your very own avatar!`,
    },
    {
      id: 'home',
      line: `Down here is My Home. That's your very own island! Chop wood, plant a garden, and build a whole world with your crew.`,
      tts: `[excitedly] Down here is My Home. [warmly] That's your very own island! [happily] Chop wood, plant a garden, and build a whole world with your crew.`,
    },
    {
      id: 'crew',
      line: `Next is the Crew button. Every story pack you finish can unlock a new friend to join us on deck!`,
      tts: `[warmly] Next is the Crew button. [happily] Every story pack you finish can unlock a new friend to join us on deck!`,
    },
    {
      id: 'profile',
      line: `This one is Profile. Pick who's playing, so brothers and sisters each get their own ship and treasure.`,
      tts: `[happily] This one is Profile. [warmly] Pick who's playing, so brothers and sisters each get their own ship and treasure.`,
    },
    {
      id: 'library',
      line: `And here's the Library, packed with amazing books and audio stories. You can open it any time!`,
      tts: `[excitedly] And here's the Library, [warmly] packed with amazing books and audio stories. [happily] You can open it any time!`,
    },
    {
      id: 'journey',
      line: `The big wheel is Journey. Turn it to steer the ship to new islands, with brand new stories to explore.`,
      tts: `[excitedly] The big wheel is Journey. Turn it to steer the ship to new islands, [warmly] with brand new stories to explore.`,
    },
    {
      id: 'hatch',
      line: `Now follow me down the hatch. The basement is where all the fun is!`,
      tts: `[playfully] Now follow me down the hatch. [excitedly] The basement is where all the fun is!`,
    },
  ];
}

/** Basement: welcome → pool → darts → arcade → library. */
export function buildAdamBasementTour(
  kidName: string | null | undefined,
  locks: { pool: TourLock; darts: TourLock },
): TourBeat[] {
  const name = firstName(kidName);
  return [
    {
      id: 'welcome',
      line: `Welcome to the basement${name ? `, ${name}` : ''}! This is where all the fun is.`,
      tts: `[excitedly] Welcome to the basement${name ? `, ${name}` : ''}! [happily] This is where all the fun is.`,
    },
    {
      id: 'pool',
      line: `That's the pool table — Speed Pool King! ${unlockLine(locks.pool, 'Tap it any time to play.')}`,
      tts: `[excitedly] That's the pool table — Speed Pool King! [warmly] ${unlockLine(locks.pool, 'Tap it any time to play.')}`,
    },
    {
      id: 'darts',
      line: `Over there is the dartboard — Poptimez! ${unlockLine(locks.darts, 'Give it a throw!')}`,
      tts: `[playfully] Over there is the dartboard — Poptimez! [happily] ${unlockLine(locks.darts, 'Give it a throw!')}`,
    },
    {
      id: 'arcade',
      line: `That glowing cabinet is the arcade. It's packed with games, and you can spend your treasure coins on new ones.`,
      tts: `[excitedly] That glowing cabinet is the arcade. [warmly] It's packed with games, and you can spend your treasure coins on new ones.`,
    },
    {
      id: 'library',
      line: `And up there is the ship's Library — amazing books and audio stories. Go on, tap the bookshelf and explore!`,
      tts: `[warmly] And up there is the ship's Library — amazing books and audio stories. [excitedly] Go on, tap the bookshelf and explore!`,
    },
  ];
}
