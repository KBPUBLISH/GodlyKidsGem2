import { islandStoryProgressService } from '../services/islandStoryProgressService';

/** Minimal story fields needed for main-map sequential unlock. */
export type MainMapUnlockStory = {
  _id: string;
  order?: number;
  quizMode?: string;
  bookId?: unknown;
  customQuestions?: unknown[];
  quiz?: {
    levels?: Partial<Record<'easy' | 'medium' | 'hard', unknown[]>>;
  };
};

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

/** Previous pack is complete when read is done and quiz is done (or N/A). */
export function isStoryPackComplete(
  islandId: string,
  story: MainMapUnlockStory,
): boolean {
  if (!islandId?.trim() || !story?._id) return false;
  const p = islandStoryProgressService.get(islandId, story._id);
  const readDone = p.read;
  const quizDone = p.quiz || !storyHasQuizContent(story);
  return readDone && quizDone;
}

/**
 * Stories must already be sorted by `order` ascending.
 * - index 0: always unlocked
 * - index i > 0: unlocked only if story i-1 has read (+ quiz when content exists)
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
