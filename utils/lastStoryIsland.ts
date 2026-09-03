const STORAGE_KEY = 'godlykids_last_story_island';

export type LastStoryIsland = {
  id: string;
  title?: string;
  path: string;
};

/**
 * No island visited yet — send the kid to the voyage map to choose one. The
 * previous default pointed at a hardcoded `genesis` island that no longer
 * exists in the CMS, which dead-ended on an empty island scene.
 */
const DEFAULT_CONTINUE: LastStoryIsland = {
  id: '',
  title: 'Your Voyage',
  path: '/map',
};

function isValidRecord(value: unknown): value is LastStoryIsland {
  if (!value || typeof value !== 'object') return false;
  const rec = value as LastStoryIsland;
  return Boolean(rec.id && rec.path && rec.path.startsWith('/'));
}

/** Remember the story island the kid is currently on (scene or island map). */
export function rememberLastStoryIsland(
  islandId: string,
  opts?: { title?: string; path?: string },
): void {
  const id = islandId.trim();
  if (!id) return;
  const record: LastStoryIsland = {
    id,
    title: opts?.title?.trim() || undefined,
    path: opts?.path || `/sail/${encodeURIComponent(id)}/lesson`,
  };
  try {
    const raw = JSON.stringify(record);
    localStorage.setItem(STORAGE_KEY, raw);
    sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* private mode */
  }
}

export function getLastStoryIsland(): LastStoryIsland | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Resume target for Explore → Continue. Falls back to the voyage map. */
export function getContinueStoryIsland(): LastStoryIsland {
  return getLastStoryIsland() || DEFAULT_CONTINUE;
}

export function clearLastStoryIsland(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
