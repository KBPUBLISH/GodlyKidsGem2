/**
 * Bible Map island scene activity progress (per island + story).
 *
 * Stored locally per account + profile, and synced on the user profile so
 * completions survive logout / profile reselect. Unlock (mainMapStoryUnlock)
 * reads through this same service.
 *
 * Product rule: treasure / puzzle / coloring unlock after pack beats are done:
 * Read + Quiz, plus Try It when the pack has it. Packs without Try It still
 * unlock after Read + Quiz so older packs are not soft-locked.
 * Quiz unlocks after read. Try It unlocks after quiz (when the pack has both).
 */

import { authService } from './authService';
import { profileService } from './profileService';

export type IslandActivityId = 'read' | 'quiz' | 'tryIt' | 'puzzle' | 'coloring' | 'game' | 'rewards';

export type IslandStoryProgress = {
  read: boolean;
  quiz: boolean;
  /** Local Try It practice complete — does not replace quiz completion. */
  tryIt?: boolean;
  puzzle?: boolean;
  coloring?: boolean;
  game?: boolean;
  /** Alias for former game activity completion */
  rewards?: boolean;
  /** Best story star rating (1–3) for this island:story. */
  readStars?: number;
  /** Wrong taps from the session that earned readStars (debug / display). */
  readWrongTaps?: number;
  updatedAt?: number;
};

/** Legacy unscoped key + prefix for account/profile-scoped keys. */
export const ISLAND_PROGRESS_STORAGE_PREFIX = 'godlykids_island_story_progress';
const LEGACY_STORAGE_KEY = ISLAND_PROGRESS_STORAGE_PREFIX;

export type ProgressMap = Record<string, IslandStoryProgress>;
/** profileId → island:story → progress (cloud payload). */
export type CloudIslandProgress = Record<string, ProgressMap>;

const EMPTY: IslandStoryProgress = { read: false, quiz: false };

/** CMS flags for the Read → Quiz → Try It pack beats. */
export type PackBeatOptions = {
  /** Default true — skip the quiz beat only when the pack has no quiz. */
  hasQuizContent?: boolean;
  /** Default false — only required when the pack actually has Try It. */
  hasTryIt?: boolean;
};

const progressKey = (islandId: string, storyId: string): string =>
  `${islandId.trim()}:${storyId.trim()}`;

const isGenesisIslandId = (islandId: string): boolean => {
  const id = islandId.trim().toLowerCase();
  return id === 'genesis' || id.includes('genesis');
};

const normalizeEntry = (entry: IslandStoryProgress | undefined): IslandStoryProgress => {
  if (!entry) return { ...EMPTY };
  return {
    read: Boolean(entry.read),
    quiz: Boolean(entry.quiz),
    tryIt: Boolean(entry.tryIt),
    puzzle: Boolean(entry.puzzle),
    coloring: Boolean(entry.coloring),
    game: Boolean(entry.game) || Boolean(entry.rewards),
    rewards: Boolean(entry.rewards) || Boolean(entry.game),
    readStars:
      typeof entry.readStars === 'number' && entry.readStars >= 1
        ? Math.min(3, Math.floor(entry.readStars))
        : undefined,
    readWrongTaps:
      typeof entry.readWrongTaps === 'number' && entry.readWrongTaps >= 0
        ? Math.floor(entry.readWrongTaps)
        : undefined,
    updatedAt: entry.updatedAt,
  };
};

const hasAnyCompletion = (entry: IslandStoryProgress | undefined): boolean => {
  if (!entry) return false;
  return Boolean(
    entry.read ||
      entry.quiz ||
      entry.tryIt ||
      entry.puzzle ||
      entry.coloring ||
      entry.game ||
      entry.rewards ||
      (typeof entry.readStars === 'number' && entry.readStars >= 1),
  );
};

const mergeEntries = (
  a: IslandStoryProgress | undefined,
  b: IslandStoryProgress | undefined,
): IslandStoryProgress => {
  const left = normalizeEntry(a);
  const right = normalizeEntry(b);
  const leftStars = left.readStars ?? 0;
  const rightStars = right.readStars ?? 0;
  const stars = Math.max(leftStars, rightStars);
  const starSource = rightStars >= leftStars ? right : left;
  return {
    read: left.read || right.read,
    quiz: left.quiz || right.quiz,
    tryIt: left.tryIt || right.tryIt,
    puzzle: left.puzzle || right.puzzle,
    coloring: left.coloring || right.coloring,
    game: left.game || right.game,
    rewards: left.rewards || right.rewards,
    readStars: stars >= 1 ? Math.min(3, stars) : undefined,
    readWrongTaps: starSource.readWrongTaps,
    updatedAt: Math.max(left.updatedAt ?? 0, right.updatedAt ?? 0) || undefined,
  };
};

const mergeMaps = (base: ProgressMap, extra: ProgressMap): ProgressMap => {
  const out: ProgressMap = { ...base };
  for (const [key, entry] of Object.entries(extra)) {
    out[key] = mergeEntries(out[key], entry);
  }
  return out;
};

const parseProgressMap = (raw: string | null): ProgressMap => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const isIslandProgressStorageKey = (key: string): boolean =>
  key === LEGACY_STORAGE_KEY || key.startsWith(`${ISLAND_PROGRESS_STORAGE_PREFIX}:`);

/** Snapshot progress keys so logout can wipe session data without losing completions. */
export const snapshotIslandProgressStorage = (): Record<string, string> => {
  const snap: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !isIslandProgressStorageKey(key)) continue;
      const value = localStorage.getItem(key);
      if (value != null) snap[key] = value;
    }
  } catch {
    /* ignore */
  }
  return snap;
};

export const restoreIslandProgressStorage = (snap: Record<string, string>): void => {
  try {
    for (const [key, value] of Object.entries(snap)) {
      if (!isIslandProgressStorageKey(key) || value == null) continue;
      localStorage.setItem(key, value);
    }
  } catch (error) {
    console.error('Error restoring island story progress:', error);
  }
};

/** Nuclear localStorage.clear() that keeps Bible Map completions. */
export const clearLocalStoragePreservingIslandProgress = (): void => {
  const snap = snapshotIslandProgressStorage();
  try {
    localStorage.clear();
  } catch {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (!isIslandProgressStorageKey(k)) localStorage.removeItem(k);
      });
      return;
    } catch {
      /* ignore */
    }
  }
  restoreIslandProgressStorage(snap);
};

const accountScope = (): string => {
  const raw =
    authService.getUserIdForBackend() ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('godlykids_user_email')) ||
    'local';
  return String(raw).trim().toLowerCase() || 'local';
};

const profileScope = (): string => profileService.getCurrentProfileId() || 'parent';

const scopedStorageKey = (account = accountScope(), profile = profileScope()): string =>
  `${ISLAND_PROGRESS_STORAGE_PREFIX}:${account}:${profile}`;

class IslandStoryProgressService {
  private cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;

  private readMap(key: string): ProgressMap {
    try {
      return parseProgressMap(localStorage.getItem(key));
    } catch (error) {
      console.error('Error reading island story progress:', error);
      return {};
    }
  }

  /**
   * Merge every store this account/profile can legally see:
   * current scoped key, same-account "parent" (pre-profile), and legacy unscoped.
   */
  private readAll(): ProgressMap {
    let merged: ProgressMap = {};
    try {
      merged = mergeMaps(merged, this.readMap(LEGACY_STORAGE_KEY));
      const account = accountScope();
      const profile = profileScope();
      merged = mergeMaps(merged, this.readMap(scopedStorageKey(account, 'parent')));
      merged = mergeMaps(merged, this.readMap(scopedStorageKey(account, profile)));
      // Anonymous session completions (played before sign-in) stay under :local:*
      if (account !== 'local') {
        merged = mergeMaps(merged, this.readMap(scopedStorageKey('local', profile)));
        merged = mergeMaps(merged, this.readMap(scopedStorageKey('local', 'parent')));
      }
    } catch (error) {
      console.error('Error reading island story progress:', error);
    }
    return merged;
  }

  private writeAll(map: ProgressMap): void {
    try {
      const key = scopedStorageKey();
      localStorage.setItem(key, JSON.stringify(map));
      // Keep the legacy key in sync so older readers / same-device unlock still work.
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
      console.error('Error saving island story progress:', error);
    }
    this.scheduleCloudSave();
  }

  private scheduleCloudSave(): void {
    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    this.cloudSaveTimer = setTimeout(() => {
      this.cloudSaveTimer = null;
      void this.saveToCloud();
    }, 1500);
  }

  private async saveToCloud(): Promise<void> {
    const userId = authService.getUserIdForBackend();
    if (!userId) return;
    try {
      await profileService.saveToCloud(userId, {
        islandStoryProgress: this.exportForCloud(),
      });
    } catch (error) {
      console.warn('🏝️ Island progress cloud save skipped:', error);
    }
  }

  /** Account-level payload for profile save/load. */
  exportForCloud(): CloudIslandProgress {
    const account = accountScope();
    const out: CloudIslandProgress = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(`${ISLAND_PROGRESS_STORAGE_PREFIX}:${account}:`)) continue;
        const profileId = key.slice(`${ISLAND_PROGRESS_STORAGE_PREFIX}:${account}:`.length);
        if (!profileId) continue;
        out[profileId] = mergeMaps(out[profileId] || {}, this.readMap(key));
      }
      const legacy = this.readMap(LEGACY_STORAGE_KEY);
      if (Object.keys(legacy).length > 0) {
        const profile = profileScope();
        out[profile] = mergeMaps(out[profile] || {}, legacy);
      }
    } catch {
      /* ignore */
    }
    return out;
  }

  /** Merge cloud completions into local stores (never downgrades a completed flag). */
  hydrateFromCloud(cloud: CloudIslandProgress | null | undefined): void {
    if (!cloud || typeof cloud !== 'object') return;
    const account = accountScope();
    try {
      for (const [profileId, map] of Object.entries(cloud)) {
        if (!profileId || !map || typeof map !== 'object') continue;
        const key = scopedStorageKey(account, profileId);
        const merged = mergeMaps(this.readMap(key), map);
        localStorage.setItem(key, JSON.stringify(merged));
      }
      // Refresh the legacy key from the current profile so unlock reads stay consistent.
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(this.readAll()));
      console.log('🏝️ Island progress hydrated from cloud');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('islandStoryProgressUpdated'));
      }
    } catch (error) {
      console.error('Error hydrating island story progress:', error);
    }
  }

  /**
   * Resolve a progress row. Story IDs are unique, so we recover completions
   * written under a different island id (fallback `genesis` vs CMS slug/_id).
   */
  private lookup(map: ProgressMap, islandId: string, storyId: string): IslandStoryProgress {
    const sid = storyId.trim();
    const iid = islandId.trim();
    if (!iid || !sid) return { ...EMPTY };

    const exact = map[progressKey(iid, sid)];
    if (hasAnyCompletion(exact)) return normalizeEntry(exact);

    if (isGenesisIslandId(iid)) {
      const genesis = map[progressKey('genesis', sid)];
      if (hasAnyCompletion(genesis)) return normalizeEntry(genesis);
    }

    const suffix = `:${sid}`;
    let best: IslandStoryProgress | undefined;
    for (const [key, entry] of Object.entries(map)) {
      if (!key.endsWith(suffix) || !hasAnyCompletion(entry)) continue;
      best = mergeEntries(best, entry);
    }
    if (best) return normalizeEntry(best);
    return normalizeEntry(exact);
  }

  get(islandId: string, storyId: string): IslandStoryProgress {
    if (!islandId?.trim() || !storyId?.trim()) return { ...EMPTY };
    return this.lookup(this.readAll(), islandId, storyId);
  }

  /** Story ids whose Rewards/treasure activity is already marked complete. */
  getStoryIdsWithRewardsComplete(): string[] {
    const ids = new Set<string>();
    try {
      for (const [key, entry] of Object.entries(this.readAll())) {
        if (!entry?.rewards && !entry?.game) continue;
        const idx = key.indexOf(':');
        const storyId = (idx > 0 ? key.slice(idx + 1) : '').trim();
        if (storyId) ids.add(storyId);
      }
    } catch {
      /* ignore */
    }
    return Array.from(ids);
  }

  /**
   * Unique stories with read complete for any of the island id aliases
   * (slug, CMS ObjectId, genesis fallback). Used when the story list is unavailable.
   */
  countReadCompleteStories(islandIds: string[]): number {
    const ids = new Set(
      islandIds.map((id) => id.trim()).filter(Boolean),
    );
    if (ids.size === 0) return 0;
    const matchGenesis = [...ids].some(isGenesisIslandId);
    const map = this.readAll();
    const storyIds = new Set<string>();
    for (const [key, entry] of Object.entries(map)) {
      const idx = key.indexOf(':');
      if (idx <= 0) continue;
      const iid = key.slice(0, idx);
      const sid = key.slice(idx + 1);
      if (!sid) continue;
      const matched = ids.has(iid) || (matchGenesis && isGenesisIslandId(iid));
      if (!matched) continue;
      if (normalizeEntry(entry).read) storyIds.add(sid);
    }
    return storyIds.size;
  }

  isComplete(islandId: string, storyId: string, activity: IslandActivityId): boolean {
    const p = this.get(islandId, storyId);
    return Boolean(p[activity]);
  }

  private writeEntry(islandId: string, storyId: string, next: IslandStoryProgress): IslandStoryProgress {
    const map = this.readAll();
    const iid = islandId.trim();
    const sid = storyId.trim();
    const keys = new Set([progressKey(iid, sid)]);
    if (isGenesisIslandId(iid)) keys.add(progressKey('genesis', sid));
    // Keep any existing alias keys for this story in sync.
    const suffix = `:${sid}`;
    for (const key of Object.keys(map)) {
      if (key.endsWith(suffix)) keys.add(key);
    }
    for (const key of keys) {
      map[key] = next;
    }
    this.writeAll(map);
    return next;
  }

  markComplete(
    islandId: string,
    storyId: string,
    activity: IslandActivityId,
  ): IslandStoryProgress {
    if (!islandId?.trim() || !storyId?.trim()) return { ...EMPTY };

    const prev = this.get(islandId, storyId);
    if (prev[activity]) {
      return prev;
    }

    const next: IslandStoryProgress = {
      ...prev,
      [activity]: true,
      ...(activity === 'rewards' || activity === 'game'
        ? { rewards: true, game: true }
        : {}),
      updatedAt: Date.now(),
    };
    const saved = this.writeEntry(islandId, storyId, next);
    console.log(`🏝️ Island progress: ${islandId}/${storyId} → ${activity} complete`);
    return saved;
  }

  /** Stamp puzzle/coloring complete when those loot types are collected. */
  markLootActivities(
    islandId: string,
    storyId: string,
    types: ReadonlyArray<string>,
  ): IslandStoryProgress {
    let next = this.get(islandId, storyId);
    for (const type of types) {
      if (type === 'puzzle' || type === 'coloring') {
        next = this.markComplete(islandId, storyId, type);
      }
    }
    return next;
  }

  /**
   * Persist story stars. Keeps the best (highest) rating.
   */
  setReadStars(
    islandId: string,
    storyId: string,
    stars: number,
    wrongTaps?: number,
  ): IslandStoryProgress {
    if (!islandId?.trim() || !storyId?.trim()) return { ...EMPTY };
    const clamped = Math.max(1, Math.min(3, Math.floor(stars))) as 1 | 2 | 3;
    const prev = this.get(islandId, storyId);
    const prevStars =
      typeof prev.readStars === 'number' && prev.readStars >= 1
        ? Math.min(3, Math.floor(prev.readStars))
        : 0;
    const nextStars = Math.max(prevStars, clamped) as 1 | 2 | 3;
    const next: IslandStoryProgress = {
      ...prev,
      read: true,
      readStars: nextStars,
      readWrongTaps:
        typeof wrongTaps === 'number' && wrongTaps >= 0
          ? Math.floor(wrongTaps)
          : prev.readWrongTaps,
      updatedAt: Date.now(),
    };
    const saved = this.writeEntry(islandId, storyId, next);
    console.log(
      `🏝️ Island stars: ${islandId}/${storyId} → ${nextStars}★ (wrongs=${next.readWrongTaps ?? '?'})`,
    );
    return saved;
  }

  /**
   * Pack beats: Read, then Quiz (if present), then Try It (if present).
   * Try It used to fill the quiz slot — `tryIt` still counts as quiz-done so
   * kids who already finished that way are not re-locked.
   */
  arePackBeatsComplete(
    islandId: string,
    storyId: string,
    opts?: PackBeatOptions,
  ): boolean {
    if (!islandId?.trim() || !storyId?.trim()) return false;
    const p = this.get(islandId, storyId);
    const quizDone =
      p.quiz || opts?.hasQuizContent === false || Boolean(p.tryIt);
    const tryItDone = opts?.hasTryIt !== true || Boolean(p.tryIt);
    return Boolean(p.read) && quizDone && tryItDone;
  }

  /**
   * Whether an activity button should be unlocked for the kid.
   * - read: always (entry point)
   * - quiz: after read
   * - tryIt: after read + quiz (quiz skipped when the pack has none)
   * - puzzle / coloring / rewards: after all present pack beats
   */
  isActivityUnlocked(
    islandId: string,
    storyId: string,
    activity: IslandActivityId,
    opts?: PackBeatOptions,
  ): boolean {
    if (activity === 'read') return true;
    const p = this.get(islandId, storyId);
    const readDone = p.read;
    const quizDone =
      p.quiz || opts?.hasQuizContent === false || Boolean(p.tryIt);
    if (activity === 'quiz') return readDone;
    if (activity === 'tryIt') return readDone && quizDone;
    return this.arePackBeatsComplete(islandId, storyId, opts);
  }

  /** Wipe local (and pending cloud) completions — used when a guest restarts onboarding. */
  clearAllLocal(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && isIslandProgressStorageKey(key)) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(LEGACY_STORAGE_KEY, '{}');
      localStorage.setItem(scopedStorageKey(), '{}');
    } catch (error) {
      console.error('Error clearing island story progress:', error);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('islandStoryProgressUpdated'));
    }
    this.scheduleCloudSave();
  }
}

export const islandStoryProgressService = new IslandStoryProgressService();
