/**
 * Story-pack unlock chrome: one-shot celebration + NEW badge until opened.
 *
 * NEW is only stamped when a sequential unlock is observed (pack N completes →
 * pack N+1 unlocks). Already-unlocked packs from before this feature shipped
 * stay unmarked.
 */

import { authService } from './authService';
import { profileService } from './profileService';
import { islandStoryProgressService } from './islandStoryProgressService';
import {
  findNewlyUnlockedNextPack,
  isPlayableMainMapStory,
  isStoryPackComplete,
  type PackUnlockCoverStory,
} from '../utils/mainMapStoryUnlock';
import { resolveBibleMapMediaUrl } from '../utils/bibleMapApi';

export const STORY_PACK_UX_STORAGE_PREFIX = 'godlykids_story_pack_ux';
export const STORY_PACK_UX_EVENT = 'storyPackUnlockUxUpdated';

export type PackUnlockCelebrationPayload = {
  islandId: string;
  packId: string;
  coverUrl: string;
  title: string;
};

type UxStore = {
  opened: string[];
  newPacks: string[];
  celebrated: string[];
  pending: PackUnlockCelebrationPayload | null;
  flag: { islandId: string; storyId: string } | null;
};

const EMPTY: UxStore = {
  opened: [],
  newPacks: [],
  celebrated: [],
  pending: null,
  flag: null,
};

const packKey = (islandId: string, storyId: string): string =>
  `${islandId.trim()}:${storyId.trim()}`;

const accountScope = (): string => {
  const raw =
    authService.getUserIdForBackend() ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('godlykids_user_email')) ||
    'local';
  return String(raw).trim().toLowerCase() || 'local';
};

const profileScope = (): string => profileService.getCurrentProfileId() || 'parent';

const scopedStorageKey = (account = accountScope(), profile = profileScope()): string =>
  `${STORY_PACK_UX_STORAGE_PREFIX}:${account}:${profile}`;

const parseStore = (raw: string | null): UxStore => {
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw) as Partial<UxStore>;
    return {
      opened: Array.isArray(parsed.opened) ? parsed.opened.filter(Boolean) : [],
      newPacks: Array.isArray(parsed.newPacks) ? parsed.newPacks.filter(Boolean) : [],
      celebrated: Array.isArray(parsed.celebrated)
        ? parsed.celebrated.filter(Boolean)
        : [],
      pending:
        parsed.pending &&
        typeof parsed.pending === 'object' &&
        parsed.pending.islandId &&
        parsed.pending.packId
          ? {
              islandId: String(parsed.pending.islandId),
              packId: String(parsed.pending.packId),
              coverUrl: String(parsed.pending.coverUrl || ''),
              title: String(parsed.pending.title || ''),
            }
          : null,
      flag:
        parsed.flag && parsed.flag.islandId && parsed.flag.storyId
          ? {
              islandId: String(parsed.flag.islandId),
              storyId: String(parsed.flag.storyId),
            }
          : null,
    };
  } catch {
    return { ...EMPTY };
  }
};

const readStore = (): UxStore => {
  try {
    return parseStore(localStorage.getItem(scopedStorageKey()));
  } catch {
    return { ...EMPTY };
  }
};

const writeStore = (store: UxStore): void => {
  try {
    localStorage.setItem(scopedStorageKey(), JSON.stringify(store));
  } catch {
    /* private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(STORY_PACK_UX_EVENT));
  }
};

const uniqPush = (list: string[], key: string): string[] =>
  list.includes(key) ? list : [...list, key];

const coverFor = (story: PackUnlockCoverStory): { coverUrl: string; title: string } => ({
  coverUrl:
    resolveBibleMapMediaUrl(story.mapIconUrl) ||
    resolveBibleMapMediaUrl(story.heroImageUrl) ||
    '',
  title: (story.displayTitle || story.title || 'New story').trim() || 'New story',
});

const sortPlayable = (stories: PackUnlockCoverStory[]): PackUnlockCoverStory[] =>
  [...stories]
    .filter((s) => isPlayableMainMapStory(s))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

class StoryPackUnlockUxService {
  /** Call only when read/quiz was newly flipped to complete. */
  flagPossibleUnlock(islandId: string, storyId: string): void {
    if (!islandId?.trim() || !storyId?.trim()) return;
    const store = readStore();
    store.flag = { islandId: islandId.trim(), storyId: storyId.trim() };
    writeStore(store);
  }

  /**
   * Mark read or quiz complete and, if that flag was new, remember this pack
   * so the next page can detect a sequential unlock.
   */
  markActivityAndFlagUnlock(
    islandId: string,
    storyId: string,
    activity: 'read' | 'quiz' | 'tryIt',
  ): void {
    if (!islandId?.trim() || !storyId?.trim()) return;
    const before = islandStoryProgressService.get(islandId, storyId);
    const already = Boolean(before[activity]);
    islandStoryProgressService.markComplete(islandId, storyId, activity);
    if (!already) this.flagPossibleUnlock(islandId, storyId);
  }

  markPackOpened(islandId: string, storyId: string): void {
    if (!islandId?.trim() || !storyId?.trim()) return;
    const key = packKey(islandId, storyId);
    const store = readStore();
    const nextOpened = uniqPush(store.opened, key);
    const nextNew = store.newPacks.filter((k) => k !== key);
    if (nextOpened === store.opened && nextNew.length === store.newPacks.length) {
      return;
    }
    store.opened = nextOpened;
    store.newPacks = nextNew;
    writeStore(store);
  }

  isPackNew(islandId: string, storyId: string): boolean {
    if (!islandId?.trim() || !storyId?.trim()) return false;
    const key = packKey(islandId, storyId);
    const store = readStore();
    if (!store.newPacks.includes(key)) return false;
    if (store.opened.includes(key)) return false;
    const progress = islandStoryProgressService.get(islandId, storyId);
    if (progress.read || progress.quiz) return false;
    return true;
  }

  markCelebrated(islandId: string, packId: string): void {
    if (!islandId?.trim() || !packId?.trim()) return;
    const key = packKey(islandId, packId);
    const store = readStore();
    store.celebrated = uniqPush(store.celebrated, key);
    if (store.pending?.islandId === islandId && store.pending.packId === packId) {
      store.pending = null;
    }
    writeStore(store);
  }

  hasCelebrated(islandId: string, packId: string): boolean {
    return readStore().celebrated.includes(packKey(islandId, packId));
  }

  /**
   * If a just-completed pack unlocked the next one, stamp NEW + pending
   * celebration (once). Returns a pending overlay payload for this island.
   */
  resolvePendingUnlock(
    islandId: string,
    stories: PackUnlockCoverStory[],
  ): PackUnlockCelebrationPayload | null {
    if (!islandId?.trim()) return null;
    const playable = sortPlayable(stories);
    const store = readStore();
    let changed = false;

    if (store.flag && store.flag.islandId === islandId.trim()) {
      const next = findNewlyUnlockedNextPack(islandId, playable, store.flag.storyId);
      if (next?._id) {
        const key = packKey(islandId, next._id);
        if (!store.celebrated.includes(key) && !store.opened.includes(key)) {
          store.newPacks = uniqPush(store.newPacks, key);
          if (!store.pending || store.pending.packId !== next._id) {
            const { coverUrl, title } = coverFor(next);
            store.pending = {
              islandId: islandId.trim(),
              packId: next._id,
              coverUrl,
              title,
            };
          }
          changed = true;
        }
        store.flag = null;
        changed = true;
      } else {
        const done = playable.find((s) => s._id === store.flag.storyId);
        // Keep the flag until pack beats are actually complete (Read + Quiz
        // + Try It when present). Clearing it on a mid-pack quiz would lose
        // the sequential unlock when Try It finishes.
        if (done && isStoryPackComplete(islandId, done)) {
          store.flag = null;
          changed = true;
        }
      }
    }

    if (changed) writeStore(store);

    const pending = readStore().pending;
    if (
      pending &&
      pending.islandId === islandId.trim() &&
      !readStore().celebrated.includes(packKey(pending.islandId, pending.packId))
    ) {
      return pending;
    }
    return null;
  }

  clearAllLocal(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORY_PACK_UX_STORAGE_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(STORY_PACK_UX_EVENT));
    }
  }
}

export const storyPackUnlockUxService = new StoryPackUnlockUxService();
