/**
 * Bible Map island scene activity progress (per island + story).
 * Stored locally — matches bookCompletionService pattern until a user-progress API exists.
 *
 * Product rule: puzzle / coloring / game unlock after both read + quiz are complete.
 * Quiz unlocks after read (when the story has quiz content).
 */

export type IslandActivityId = 'read' | 'quiz' | 'puzzle' | 'coloring' | 'game';

export type IslandStoryProgress = {
  read: boolean;
  quiz: boolean;
  puzzle?: boolean;
  coloring?: boolean;
  game?: boolean;
  /** Best Bible Map hunt star rating (1–3) for this island:story. */
  readStars?: number;
  /** Wrong taps from the session that earned readStars (debug / display). */
  readWrongTaps?: number;
  updatedAt?: number;
};

const STORAGE_KEY = 'godlykids_island_story_progress';

type ProgressMap = Record<string, IslandStoryProgress>;

const EMPTY: IslandStoryProgress = { read: false, quiz: false };

const progressKey = (islandId: string, storyId: string): string =>
  `${islandId.trim()}:${storyId.trim()}`;

class IslandStoryProgressService {
  private readAll(): ProgressMap {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ProgressMap;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.error('Error reading island story progress:', error);
      return {};
    }
  }

  private writeAll(map: ProgressMap): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
      console.error('Error saving island story progress:', error);
    }
  }

  get(islandId: string, storyId: string): IslandStoryProgress {
    if (!islandId?.trim() || !storyId?.trim()) return { ...EMPTY };
    const entry = this.readAll()[progressKey(islandId, storyId)];
    if (!entry) return { ...EMPTY };
    return {
      read: Boolean(entry.read),
      quiz: Boolean(entry.quiz),
      puzzle: Boolean(entry.puzzle),
      coloring: Boolean(entry.coloring),
      game: Boolean(entry.game),
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
  }

  isComplete(islandId: string, storyId: string, activity: IslandActivityId): boolean {
    const p = this.get(islandId, storyId);
    return Boolean(p[activity]);
  }

  markComplete(
    islandId: string,
    storyId: string,
    activity: IslandActivityId,
  ): IslandStoryProgress {
    if (!islandId?.trim() || !storyId?.trim()) return { ...EMPTY };

    const map = this.readAll();
    const key = progressKey(islandId, storyId);
    const prev = map[key] || { ...EMPTY };
    if (prev[activity]) {
      return {
        read: Boolean(prev.read),
        quiz: Boolean(prev.quiz),
        puzzle: Boolean(prev.puzzle),
        coloring: Boolean(prev.coloring),
        game: Boolean(prev.game),
        readStars: prev.readStars,
        readWrongTaps: prev.readWrongTaps,
        updatedAt: prev.updatedAt,
      };
    }

    const next: IslandStoryProgress = {
      ...prev,
      [activity]: true,
      updatedAt: Date.now(),
    };
    map[key] = next;
    this.writeAll(map);
    console.log(`🏝️ Island progress: ${islandId}/${storyId} → ${activity} complete`);
    return next;
  }


  /**
   * Persist hunt stars for a story. Keeps the best (highest) rating.
   */
  setReadStars(
    islandId: string,
    storyId: string,
    stars: number,
    wrongTaps?: number,
  ): IslandStoryProgress {
    if (!islandId?.trim() || !storyId?.trim()) return { ...EMPTY };
    const clamped = Math.max(1, Math.min(3, Math.floor(stars))) as 1 | 2 | 3;
    const map = this.readAll();
    const key = progressKey(islandId, storyId);
    const prev = map[key] || { ...EMPTY };
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
    map[key] = next;
    this.writeAll(map);
    console.log(
      `🏝️ Island stars: ${islandId}/${storyId} → ${nextStars}★ (wrongs=${next.readWrongTaps ?? '?'})`,
    );
    return next;
  }

  /**
   * Whether an activity button should be unlocked for the kid.
   * - read: always (entry point)
   * - quiz: after read (if story has no quiz, treated as not applicable by caller)
   * - puzzle / coloring / game: after both read and quiz
   */
  isActivityUnlocked(
    islandId: string,
    storyId: string,
    activity: IslandActivityId,
    opts?: { hasQuizContent?: boolean },
  ): boolean {
    if (activity === 'read') return true;
    const p = this.get(islandId, storyId);
    const readDone = p.read;
    const quizDone = p.quiz || opts?.hasQuizContent === false;
    if (activity === 'quiz') return readDone;
    return readDone && quizDone;
  }
}

export const islandStoryProgressService = new IslandStoryProgressService();
