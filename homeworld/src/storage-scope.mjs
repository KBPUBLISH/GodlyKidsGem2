/**
 * Per-profile localStorage namespace for the island.
 *
 * The parent app opens the island as `/homeworld/index.html?…&profile=<scope>`
 * where `<scope>` is `<account>:<profileId>` (utils/profileScope.ts). Every
 * island key — the save, residents, onboarding, goal — is stored as
 * `${base}:${scope}` so each kid profile has its own world. Without a profile
 * param (standalone dev page, node tests) keys stay unscoped, exactly as before.
 *
 * MIGRATION mirrors the parent: the first scope to run after the change inherits
 * the legacy unscoped values (copied, legacy left in place), remembered in
 * `godlykids_profile_scope_migrated_v1`; every other profile starts fresh.
 * Whichever side (parent app or island) boots first does it; both agree.
 */

const MIGRATION_KEY = 'godlykids_profile_scope_migrated_v1';

/** Legacy keys the island may have to inherit. Keep in sync with utils/profileScope.ts. */
export const LEGACY_KEYS = [
  'godlykids_homeworld_playtest_v1',
  'godlykids_homeworld_playtest_v1_backup',
  'godlykids_players_world_residents_v1',
  'gk_home_onboarding_v1',
  'gk_island_goal_v1',
];

function readScope() {
  try {
    if (typeof location === 'undefined') return '';
    return String(new URLSearchParams(location.search).get('profile') || '').trim();
  } catch {
    return '';
  }
}

/** The active profile scope from the page URL ('' = unscoped / legacy behaviour). */
export const PROFILE_SCOPE = readScope();

/** `${base}:${scope}` under a profile, or `base` itself when the island runs unscoped. */
export function scopeKey(base, scope = PROFILE_SCOPE) {
  return scope ? `${base}:${scope}` : base;
}

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Copy legacy unscoped values into the active scope when this scope owns them
 * (first scope ever seen, or already marked as the owner). Returns the keys copied.
 */
export function migrateLegacyKeys(bases = LEGACY_KEYS, storage = defaultStorage(), scope = PROFILE_SCOPE) {
  const copied = [];
  if (!scope || !storage) return copied;
  try {
    let marker = storage.getItem(MIGRATION_KEY);
    if (!marker) {
      storage.setItem(MIGRATION_KEY, scope);
      marker = scope;
    }
    if (marker !== scope) return copied;
    for (const base of bases) {
      const target = `${base}:${scope}`;
      if (storage.getItem(target) !== null) continue;
      const raw = storage.getItem(base);
      if (raw === null) continue;
      storage.setItem(target, raw);
      copied.push(target);
    }
  } catch {
    /* storage unavailable or full: play from whatever is there */
  }
  return copied;
}

/**
 * Owner scope only: if the legacy unscoped value is newer than the scoped one
 * (an older cached island bundle kept writing the legacy key for a while after
 * the parent app moved to per-profile keys), adopt it. `newer(legacy, current)`
 * decides; a missing scoped value always adopts. Returns true when copied.
 */
export function adoptNewerLegacy(base, newer, storage = defaultStorage(), scope = PROFILE_SCOPE) {
  if (!scope || !storage) return false;
  try {
    if (storage.getItem(MIGRATION_KEY) !== scope) return false;
    const legacy = storage.getItem(base);
    if (legacy === null) return false;
    const current = storage.getItem(`${base}:${scope}`);
    if (current !== null && !newer(legacy, current)) return false;
    storage.setItem(`${base}:${scope}`, legacy);
    return true;
  } catch {
    return false;
  }
}

/** Posted by the parent (`gk-profile {scope}`): a frame showing another profile reloads under the right one. */
export function ensureFrameScope(scope) {
  const wanted = String(scope || '').trim();
  if (!wanted || wanted === PROFILE_SCOPE) return false;
  try {
    const url = new URL(location.href);
    url.searchParams.set('profile', wanted);
    location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}
