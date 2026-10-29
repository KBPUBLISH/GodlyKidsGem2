/**
 * Per-profile storage scope for everything "My Home" / crew related.
 *
 * Each kid profile owns its own island world: the island save, the residents
 * living there, the collected story characters / crew roster, the My Home
 * onboarding state, … All of those modules keep their historical base key but
 * read/write through `scopedKey(base)`, which appends the active profile scope:
 *
 *     <account>:<profileId>      e.g. "parent@example.com:1793027396878"
 *
 * `account` is the same identity the Bible Map island progress uses
 * (authService user id / email, else the saved email, else "local") and
 * `profileId` is profileService's current profile ("parent" when no kid
 * profile is active). The same scope string is passed to the homeworld iframe
 * (`?profile=<scope>`), which namespaces its own localStorage keys identically
 * (homeworld/src/storage-scope.mjs).
 *
 * MIGRATION — the first profile seen after this change inherits the legacy,
 * unscoped data (copy, not move) so nobody loses the island they already built.
 * The scope that inherited is remembered in `godlykids_profile_scope_migrated_v1`;
 * every other profile starts fresh. The homeworld bundle runs the same rule for
 * its keys, so whichever side loads first migrates and the other one agrees.
 */

import { authService } from '../services/authService';
import { profileService } from '../services/profileService';

/** localStorage key remembering which scope inherited the legacy (unscoped) data. */
export const PROFILE_SCOPE_MIGRATION_KEY = 'godlykids_profile_scope_migrated_v1';

/** Profile segment used when no kid profile is active (parent / account owner). */
export const PARENT_PROFILE_SEGMENT = 'parent';

/**
 * Legacy unscoped keys copied into the first profile's scope. Keep in sync with
 * LEGACY_KEYS in homeworld/src/storage-scope.mjs (the island migrates its own
 * subset of these when it boots before the parent app did).
 */
export const LEGACY_PROFILE_SCOPED_KEYS = [
  'godlykids_rewards_v1',
  'godlykids_rewards_cms_sync_at',
  'godlykids_rewards_cms_sync_stories',
  'godlykids_players_world_residents_v1',
  'godlykids_homeworld_playtest_v1',
  'godlykids_homeworld_playtest_v1_backup',
  'gk_home_onboarding_v1',
  'gk_island_goal_v1',
] as const;

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Account part of the scope — same resolution the island story progress uses. */
export function getAccountScope(): string {
  let raw: string | null = null;
  try {
    raw = authService.getUserIdForBackend();
  } catch {
    raw = null;
  }
  if (!raw) {
    try {
      raw = storage()?.getItem('godlykids_user_email') ?? null;
    } catch {
      raw = null;
    }
  }
  const account = String(raw || '').trim().toLowerCase();
  return account || 'local';
}

/** Profile part of the scope: the active kid profile id, or "parent". */
export function getProfileSegment(): string {
  let id: string | null = null;
  try {
    id = profileService.getCurrentProfileId();
  } catch {
    id = null;
  }
  const seg = String(id || '').trim();
  return seg || PARENT_PROFILE_SEGMENT;
}

/** Stable scope for the active profile: `<account>:<profileId>`. */
export function getProfileScopeKey(): string {
  return `${getAccountScope()}:${getProfileSegment()}`;
}

/** Scope string for a specific profile id of the current account (used on delete). */
export function profileScopeKeyFor(profileId: string | null | undefined): string {
  const seg = String(profileId || '').trim() || PARENT_PROFILE_SEGMENT;
  return `${getAccountScope()}:${seg}`;
}

/** `${base}:${scope}` — the localStorage key for `base` under the active profile. */
export function scopedKey(base: string, scope: string = getProfileScopeKey()): string {
  ensureLegacyMigration(scope);
  return `${base}:${scope}`;
}

/** Subscribe to profile switches (fires with the new scope). */
export function onProfileScopeChange(callback: (scope: string) => void): () => void {
  return profileService.onProfileChange(() => callback(getProfileScopeKey()));
}

/* ------------------------------------------------------------------------ *
 * Migration
 * ------------------------------------------------------------------------ */

let migratedForScope: string | null = null;

export type ProfileScopeMigrationResult = {
  scope: string;
  /** Legacy keys copied into this scope during this call. */
  copied: string[];
  /** True when this scope is the one that owns the legacy data. */
  owner: boolean;
};

function copyMissing(store: Storage, from: string, to: string, copied: string[]): void {
  try {
    if (store.getItem(to) !== null) return;
    const raw = store.getItem(from);
    if (raw === null) return;
    store.setItem(to, raw);
    copied.push(to);
  } catch {
    /* quota / private mode: the legacy value stays where it is */
  }
}

/**
 * Copy the legacy unscoped My Home / crew keys into `scope` when that scope is
 * (or becomes) the one that inherited them. Idempotent and cheap: a handful of
 * getItem calls, memoised per scope for the session.
 *
 * - No marker yet → this scope becomes the owner and receives the copies.
 * - Marker names this scope → copy any legacy key still missing here.
 * - Marker names the same profile under a different account (guest session
 *   that later signed in) and this scope is empty → adopt the old scope's data
 *   and move the marker here.
 * - Marker names another scope → nothing; this profile starts fresh.
 */
export function ensureLegacyMigration(scope: string = getProfileScopeKey()): ProfileScopeMigrationResult {
  const result: ProfileScopeMigrationResult = { scope, copied: [], owner: false };
  if (migratedForScope === scope) {
    result.owner = readMarker() === scope;
    return result;
  }
  const store = storage();
  if (!store) return result;
  let marker = readMarker();

  if (!marker) {
    try {
      store.setItem(PROFILE_SCOPE_MIGRATION_KEY, scope);
    } catch {
      /* ignore */
    }
    marker = scope;
  } else if (marker !== scope) {
    const [, markerProfile = ''] = splitScope(marker);
    const [, profile = ''] = splitScope(scope);
    const empty = LEGACY_PROFILE_SCOPED_KEYS.every((base) => store.getItem(`${base}:${scope}`) === null);
    if (markerProfile === profile && empty) {
      // Same profile, new account identity: carry the data over once.
      for (const base of LEGACY_PROFILE_SCOPED_KEYS) copyMissing(store, `${base}:${marker}`, `${base}:${scope}`, result.copied);
      try {
        store.setItem(PROFILE_SCOPE_MIGRATION_KEY, scope);
      } catch {
        /* ignore */
      }
      marker = scope;
    }
  }

  if (marker === scope) {
    result.owner = true;
    for (const base of LEGACY_PROFILE_SCOPED_KEYS) copyMissing(store, base, `${base}:${scope}`, result.copied);
  }
  migratedForScope = scope;
  if (result.copied.length) {
    console.log(`👤 profile scope: migrated legacy My Home data into "${scope}" (${result.copied.length} keys)`);
  }
  return result;
}

function readMarker(): string | null {
  try {
    return storage()?.getItem(PROFILE_SCOPE_MIGRATION_KEY) || null;
  } catch {
    return null;
  }
}

function splitScope(scope: string): [string, string] {
  const idx = scope.lastIndexOf(':');
  return idx < 0 ? [scope, ''] : [scope.slice(0, idx), scope.slice(idx + 1)];
}

/** Is this (un-suffixed) base key one of the per-profile My Home / crew keys? */
function isHomeScopedBase(base: string): boolean {
  return (
    (LEGACY_PROFILE_SCOPED_KEYS as readonly string[]).includes(base) ||
    base.startsWith('godlykids_homeworld_playtest_v1') ||
    base.startsWith('crewChatHistory:') ||
    base.startsWith('crewChatAsked:') ||
    base === 'gk_island_greetings_v1'
  );
}

/**
 * Forget a deleted profile's island: every scoped My Home / crew key (island
 * save + its backups, residents, rewards, onboarding, goal, chat memory).
 * Never touches the legacy unscoped keys, the migration marker, or the
 * cloud-synced story progress.
 */
export function removeProfileScopedKeys(scope: string): string[] {
  const store = storage();
  if (!store || !scope) return [];
  const suffix = `:${scope}`;
  const doomed: string[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.endsWith(suffix) && isHomeScopedBase(key.slice(0, -suffix.length))) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  } catch {
    /* ignore */
  }
  if (migratedForScope === scope) migratedForScope = null;
  return doomed;
}
