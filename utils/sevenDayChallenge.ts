import {
  isPlayableMainMapStory,
  isStoryPackComplete,
  type MainMapUnlockStory,
} from './mainMapStoryUnlock';
import {
  fetchOceanMapIslands,
  fetchPublishedMapStories,
  storyIslandKeys,
  type OceanMapStoryRow,
} from './oceanMapIslands';

const STORAGE_KEY = 'godlykids_seven_day_challenge_v1';
export const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;
export const CHALLENGE_PACK_COUNT = 7;

export type ChallengePack = {
  id: string;
  title: string;
  complete: boolean;
};

type StoryRow = OceanMapStoryRow &
  MainMapUnlockStory & {
    title?: string;
    displayTitle?: string;
    order?: number;
    tryIt?: MainMapUnlockStory['tryIt'];
  };

export function getChallengeStartedAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const started = Date.parse(raw);
    return Number.isFinite(started) ? started : null;
  } catch {
    return null;
  }
}

export function isSevenDayChallengeActive(now = Date.now()): boolean {
  const started = getChallengeStartedAt();
  if (started == null) return false;
  return now < started + SEVEN_DAY_MS;
}

/** Starts the 7-day window once. Later calls keep the original start. */
export function startSevenDayChallenge(): void {
  if (getChallengeStartedAt() != null) return;
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event('sevenDayChallengeUpdated'));
}

export function challengeRemainingMs(now = Date.now()): number {
  const started = getChallengeStartedAt();
  if (started == null) return 0;
  return Math.max(0, started + SEVEN_DAY_MS - now);
}

export function formatChallengeCountdown(ms: number): string {
  if (ms <= 0) return '0d 0h';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** First 7 published story packs in voyage order, with completion from local progress. */
export async function loadChallengePacks(signal?: AbortSignal): Promise<ChallengePack[]> {
  const [islands, stories] = await Promise.all([
    fetchOceanMapIslands(signal),
    fetchPublishedMapStories(signal),
  ]);
  if (!islands || !stories) return [];

  const packs: ChallengePack[] = [];
  for (const island of islands) {
    const aliases = new Set([island.id, island.cmsId].filter(Boolean) as string[]);
    const rows = (stories as StoryRow[])
      .filter((row) => {
        if (!isPlayableMainMapStory(row)) return false;
        return storyIslandKeys(row).some((key) => aliases.has(key));
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const row of rows) {
      const title = (row.displayTitle || row.title || `Story pack ${packs.length + 1}`).trim();
      packs.push({
        id: row._id,
        title,
        complete: isStoryPackComplete(island.id, row),
      });
      if (packs.length === CHALLENGE_PACK_COUNT) return packs;
    }
  }

  while (packs.length < CHALLENGE_PACK_COUNT) {
    packs.push({
      id: `placeholder-${packs.length + 1}`,
      title: `Story pack ${packs.length + 1}`,
      complete: false,
    });
  }
  return packs;
}
