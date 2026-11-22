/**
 * Island feed: a compact, persisted log of what the kid's island friends did.
 *
 * The island only runs while the kid is on My Home, but the Crew page (a
 * separate React route) wants to show "Abel tilled a new garden plot" style
 * notices later. So wherever a friend's action already toasts, call
 * `noteEvent(kind, text, {who})` as well. Entries land in localStorage under
 * `godlykids_island_feed` (scoped per kid profile like every other island key),
 * newest last, capped at FEED_CAP. Same-tab listeners get a CustomEvent on
 * `window`, and the embedding app (My Home iframe parent) gets a postMessage.
 *
 * Only friends' actions belong here — never the character the kid is playing.
 */
import { scopeKey } from './storage-scope.mjs';

export const FEED_KEY_BASE = 'godlykids_island_feed';
export const FEED_KEY = scopeKey(FEED_KEY_BASE);
/** CustomEvent name dispatched on `window` (detail: the new entry). */
export const FEED_EVENT = 'gk-island-feed';
/** Message type posted to the parent window when the island runs in an iframe. */
export const FEED_MESSAGE = 'gk-island-feed';
export const FEED_CAP = 40;
/** Same text again within this window is treated as a repeat and dropped. */
const DEDUPE_MS = 45_000;

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Parsed feed (oldest → newest); never throws. */
export function readFeed(storage = defaultStorage(), key = FEED_KEY) {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.text === 'string' && typeof e.at === 'number') : [];
  } catch {
    return [];
  }
}

let counter = 0;
function makeId(at) {
  counter = (counter + 1) % 1000;
  return `${at.toString(36)}-${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/**
 * Append one notable friend action. `kind` is a short icon hint for the app
 * (garden | chop | mine | fish | fire | guard | meal | night | dawn | build |
 * note). Pass `id` to make an entry idempotent (e.g. a morning line for day N).
 * Returns the stored entry, or null when skipped (empty text / duplicate).
 */
export function noteEvent(kind, text, { who = '', at = Date.now(), id = null, storage = defaultStorage(), key = FEED_KEY } = {}) {
  const line = String(text || '').trim();
  if (!line || !storage) return null;
  const feed = readFeed(storage, key);
  if (id && feed.some((e) => e.id === id)) return null;
  const last = feed[feed.length - 1];
  if (!id && last && last.text === line && Math.abs(at - last.at) < DEDUPE_MS) return null;
  const entry = { id: id || makeId(at), at, kind: String(kind || 'note'), text: line, who: String(who || '') };
  const next = [...feed, entry].slice(-FEED_CAP);
  try {
    storage.setItem(key, JSON.stringify(next));
  } catch {
    return null; // quota or private mode: the toast still showed on the island
  }
  announce(entry);
  return entry;
}

function announce(entry) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(FEED_EVENT, { detail: entry }));
  } catch {
    /* no CustomEvent (tests) */
  }
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: FEED_MESSAGE, entry }, '*');
  } catch {
    /* cross-origin parent: the storage write is enough */
  }
}
