import { getBibleMapApiRoot } from './bibleMapApi';
import { storyHasQuizContent, type MainMapUnlockStory } from './mainMapStoryUnlock';
import { islandStoryProgressService } from '../services/islandStoryProgressService';

/**
 * Ship-basement game locks — each game unlocks once a Bible Map island is
 * complete (every story on the island has read + quiz done; quiz is waived
 * for stories without quiz content — same rule as main-map sequential unlock).
 *
 * Story lists come from the Bible Map CMS and are cached in localStorage so
 * lock state resolves instantly (and offline) after the first visit.
 */

export type BasementGameId = 'pool' | 'darts';

export type BasementIslandRequirement = {
  islandId: string;
  /** Kid-facing island name for plaque / hint copy. */
  islandLabel: string;
};

export type BasementGameLockConfig = {
  /**
   * Ordered preference — the first island that actually has stories in the
   * CMS is used as the requirement (later entries are fallbacks so a game
   * never locks behind an empty island).
   */
  requirements: BasementIslandRequirement[];
  /** How the plaque names the game (e.g. "the pool table"). */
  gameLabel: string;
};

export const BASEMENT_GAME_LOCKS: Record<BasementGameId, BasementGameLockConfig> = {
  pool: {
    requirements: [{ islandId: 'genesis', islandLabel: 'Genesis Island' }],
    gameLabel: 'the pool table',
  },
  darts: {
    requirements: [
      { islandId: 'exodus', islandLabel: 'Exodus Island' },
      { islandId: 'genesis', islandLabel: 'Genesis Island' },
    ],
    gameLabel: 'the dartboard',
  },
};

export type BasementGameLockState = {
  locked: boolean;
  islandLabel: string;
  /** Wood-plaque message shown when a locked game is tapped. */
  message: string;
};

export type BasementGameLockStates = Record<BasementGameId, BasementGameLockState>;

type CachedIslandStory = { id: string; hasQuizContent: boolean };
type IslandStoriesCache = Record<
  string,
  { stories: CachedIslandStory[]; updatedAt: number }
>;

const CACHE_KEY = 'godlykids_basement_island_stories';

const readCache = (): IslandStoriesCache => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as IslandStoriesCache;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeCache = (cache: IslandStoriesCache): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Best-effort cache; lock state still resolves from the network.
  }
};

const isIslandComplete = (islandId: string, stories: CachedIslandStory[]): boolean =>
  stories.length > 0 &&
  stories.every((s) => {
    const p = islandStoryProgressService.get(islandId, s.id);
    return p.read && (p.quiz || !s.hasQuizContent);
  });

const resolveLockState = (
  config: BasementGameLockConfig,
  storiesByIsland: Record<string, CachedIslandStory[] | undefined>,
): BasementGameLockState => {
  const withContent = config.requirements.find(
    (r) => (storiesByIsland[r.islandId] ?? []).length > 0,
  );
  const requirement = withContent ?? config.requirements[0];
  const stories = storiesByIsland[requirement.islandId] ?? [];
  return {
    locked: !isIslandComplete(requirement.islandId, stories),
    islandLabel: requirement.islandLabel,
    message: `Complete ${requirement.islandLabel} to unlock ${config.gameLabel}!`,
  };
};

const computeStates = (
  storiesByIsland: Record<string, CachedIslandStory[] | undefined>,
): BasementGameLockStates => ({
  pool: resolveLockState(BASEMENT_GAME_LOCKS.pool, storiesByIsland),
  darts: resolveLockState(BASEMENT_GAME_LOCKS.darts, storiesByIsland),
});

const cacheToStoriesMap = (
  cache: IslandStoriesCache,
): Record<string, CachedIslandStory[] | undefined> => {
  const map: Record<string, CachedIslandStory[] | undefined> = {};
  for (const [islandId, entry] of Object.entries(cache)) {
    map[islandId] = Array.isArray(entry?.stories) ? entry.stories : [];
  }
  return map;
};

/**
 * Synchronous lock states from the cached story lists.
 * Islands never fetched before count as locked (the kid can't have completed
 * an island they've never loaded).
 */
export const getBasementGameLockStates = (): BasementGameLockStates =>
  computeStates(cacheToStoriesMap(readCache()));

const requiredIslandIds = (): string[] => {
  const ids = new Set<string>();
  for (const config of Object.values(BASEMENT_GAME_LOCKS)) {
    for (const r of config.requirements) ids.add(r.islandId);
  }
  return [...ids];
};

type ApiStoryRow = MainMapUnlockStory & { status?: string };

const fetchIslandStories = async (
  islandId: string,
  signal?: AbortSignal,
): Promise<CachedIslandStory[] | null> => {
  const res = await fetch(
    `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
    { signal },
  );
  if (res.status === 404) return []; // island doesn't exist → no content
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { stories?: ApiStoryRow[] };
  const list = Array.isArray(data.stories) ? data.stories : [];
  return list
    .filter((s) => s && s._id)
    .map((s) => ({ id: String(s._id), hasQuizContent: storyHasQuizContent(s) }));
};

/**
 * Refresh story lists from the CMS (updating the cache) and return fresh lock
 * states. Islands that fail to fetch keep their cached list.
 */
export const refreshBasementGameLockStates = async (
  signal?: AbortSignal,
): Promise<BasementGameLockStates> => {
  const cache = readCache();
  let changed = false;

  await Promise.all(
    requiredIslandIds().map(async (islandId) => {
      try {
        const stories = await fetchIslandStories(islandId, signal);
        if (stories) {
          cache[islandId] = { stories, updatedAt: Date.now() };
          changed = true;
        }
      } catch {
        // Network / abort — keep cached entry (or none) for this island.
      }
    }),
  );

  if (changed) writeCache(cache);
  return computeStates(cacheToStoriesMap(cache));
};
