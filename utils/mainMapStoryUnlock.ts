import { islandStoryProgressService } from '../services/islandStoryProgressService';
import { storyHasTryIt, type TryItPayload } from './tryItContent';

/** Minimal story fields needed for main-map sequential unlock. */
export type MainMapUnlockStory = {
  _id: string;
  order?: number;
  status?: string;
  quizMode?: string;
  bookId?: unknown;
  customQuestions?: unknown[];
  quiz?: {
    levels?: Partial<Record<'easy' | 'medium' | 'hard', unknown[]>>;
  };
  tryIt?: TryItPayload;
};

/** Kid-facing packs only — drafts must not sit in the sequential lock chain. */
export function isPlayableMainMapStory(
  s: Pick<MainMapUnlockStory, '_id' | 'status'> | null | undefined,
): boolean {
  if (!s?._id) return false;
  if (s.status === 'draft' || s.status === 'archived') return false;
  return true;
}

/**
 * Match Island Scene / Island Lesson quiz-content detection.
 * No quiz → treat quiz gate as satisfied once read is done.
 */
export function storyHasQuizContent(s: MainMapUnlockStory | null | undefined): boolean {
  if (!s || s.quizMode === 'none') return false;
  const levels = s.quiz?.levels;
  const leveled =
    (Array.isArray(levels?.easy) && levels!.easy!.length > 0) ||
    (Array.isArray(levels?.medium) && levels!.medium!.length > 0) ||
    (Array.isArray(levels?.hard) && levels!.hard!.length > 0);
  if (leveled) return true;
  if (Array.isArray(s.customQuestions) && s.customQuestions.length > 0) return true;
  if (s.quizMode === 'book_quiz' && s.bookId) return true;
  return false;
}

/**
 * Previous pack is complete when Read + Quiz are done, plus Try It when the
 * pack has it. Packs without Try It still complete after Read + Quiz.
 */
export function isStoryPackComplete(
  islandId: string,
  story: MainMapUnlockStory,
): boolean {
  if (!islandId?.trim() || !story?._id) return false;
  return islandStoryProgressService.arePackBeatsComplete(islandId, story._id, {
    hasQuizContent: storyHasQuizContent(story),
    hasTryIt: storyHasTryIt(story),
  });
}

/**
 * Stories must already be sorted by `order` ascending.
 * - index 0: always unlocked
 * - index i > 0: unlocked only if story i-1 pack beats are complete
 */
export function isStoryUnlocked(
  islandId: string,
  stories: MainMapUnlockStory[],
  index: number,
): boolean {
  if (index <= 0) return true;
  const prev = stories[index - 1];
  if (!prev?._id) return false;
  return isStoryPackComplete(islandId, prev);
}

/** Story fields used when the next pack pops as a cover celebration. */
export type PackUnlockCoverStory = MainMapUnlockStory & {
  mapIconUrl?: string;
  heroImageUrl?: string;
  title?: string;
  displayTitle?: string;
};

/**
 * After `completedStoryId` is a finished pack, return the next pack if that
 * completion is what unlocked it. Stories should already be playable + order-sorted.
 */
export function findNewlyUnlockedNextPack(
  islandId: string,
  stories: MainMapUnlockStory[],
  completedStoryId: string,
): PackUnlockCoverStory | null {
  if (!islandId?.trim() || !completedStoryId?.trim()) return null;
  const playable = stories.filter(isPlayableMainMapStory);
  const idx = playable.findIndex((s) => s._id === completedStoryId);
  if (idx < 0) return null;
  const done = playable[idx];
  if (!done || !isStoryPackComplete(islandId, done)) return null;
  const next = playable[idx + 1];
  if (!next?._id) return null;
  if (!isStoryUnlocked(islandId, playable, idx + 1)) return null;
  return next;
}
