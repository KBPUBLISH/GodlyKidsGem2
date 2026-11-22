/**
 * Per-device preferences for reading island (Bible Map) stories.
 *
 * Island stories are "listen first": narration starts as soon as the page is
 * ready, and a finger cue shows kids they can tap the picture/video to go
 * full screen. How many times they've followed that cue is remembered here.
 */

const FULLSCREEN_HINT_KEY = 'godlykids_reader_fullscreen_hint_v1';

/** Stop nudging once the kid has gone full screen this many times. */
export const FULLSCREEN_HINT_MAX_SHOWS = 3;

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
};

/** How many times the kid has already followed the tap-for-full-screen cue. */
export const getFullscreenHintUses = (): number => {
  const n = Number(safeGet(FULLSCREEN_HINT_KEY) || 0);
  return Number.isFinite(n) ? n : 0;
};

export const shouldShowFullscreenHint = (): boolean =>
  getFullscreenHintUses() < FULLSCREEN_HINT_MAX_SHOWS;

export const recordFullscreenHintUse = () =>
  safeSet(FULLSCREEN_HINT_KEY, String(getFullscreenHintUses() + 1));
