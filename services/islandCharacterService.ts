/**
 * Island character profiles for Bible friends the island's static canon does not know.
 *
 * The My Home island (iframe, homeworld/) has no backend access of its own: when a dropped-off story
 * friend is not in `homeworld/src/characters.mjs`, it posts `gk-character-profile-please` and this
 * page-side helper asks `POST /api/island/character-profile`, then MyHomePage posts the answer back
 * as `gk-character-profile`. The island validates and caches the profile itself under
 * `godlykids_island_charprofile_v1:<key>` (name-only knowledge, not profile-scoped).
 *
 * Only story / reward friends ever get here (the island gates on reward id / sourceStoryId); travellers
 * with made-up names never do. A null profile means "keep the generic helper card".
 */
import { getApiBaseUrl } from './apiService';

export type IslandCharacterProfile = Record<string, unknown> & { name: string; roleId: string; leadership?: number };

export type IslandCharacterProfileRequest = {
  name: string;
  /** Reward id and story id, passed to the model as hints and used by the backend log. */
  id?: string;
  sourceStoryId?: string;
};

const REQUEST_TIMEOUT_MS = 12000;
/** Same canonical device id the auth / foreman routes use. */
export function islandDeviceId(): string {
  let deviceId = localStorage.getItem('godlykids_device_id') || localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem('godlykids_device_id', deviceId);
  }
  return deviceId;
}

const inFlight = new Map<string, Promise<IslandCharacterProfile | null>>();

/** Fetches (or reuses an in-flight fetch for) one friend's profile. Resolves null on any failure. */
export function fetchIslandCharacterProfile(req: IslandCharacterProfileRequest): Promise<IslandCharacterProfile | null> {
  const name = String(req.name || '').trim();
  if (!name) return Promise.resolve(null);
  const key = name.toLowerCase();
  const pending = inFlight.get(key);
  if (pending) return pending;
  const run = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const tags = [req.id, req.sourceStoryId ? `story:${req.sourceStoryId}` : ''].filter((t): t is string => !!t);
      const res = await fetch(`${getApiBaseUrl()}island/character-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ name, tags, deviceId: islandDeviceId() }),
      });
      const data = (await res.json().catch(() => null)) as { profile?: IslandCharacterProfile | null } | null;
      if (!res.ok || !data?.profile || typeof data.profile !== 'object') return null;
      return data.profile;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, run);
  return run;
}
