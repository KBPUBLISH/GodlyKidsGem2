import { profileService } from './profileService';
import type { PuzzleDifficulty } from '../utils/slidingPuzzle';

const BASE_KEY = 'godlykids_puzzle_leaderboard';
const MAX_ENTRIES_PER_BOARD = 10;

export type PuzzleScoreEntry = {
  islandId: string;
  storyId: string;
  difficulty: PuzzleDifficulty;
  moves: number;
  stars: 1 | 2 | 3;
  name: string;
  at: number;
};

const boardKey = (
  islandId: string,
  storyId: string,
  difficulty: PuzzleDifficulty,
): string => `${islandId}::${storyId || '_'}::${difficulty}`;

const readAll = (): PuzzleScoreEntry[] =>
  profileService.getProfileData<PuzzleScoreEntry[]>(BASE_KEY, []);

const writeAll = (entries: PuzzleScoreEntry[]): void => {
  profileService.setProfileData(BASE_KEY, entries);
};

/** Kid-friendly fallback when no profile name is available. */
export function defaultPuzzlePlayerName(): string {
  const names = [
    'Explorer',
    'Sailor',
    'Captain',
    'Treasure Hunter',
    'Little Hero',
  ];
  return names[Math.floor(Math.random() * names.length)]!;
}

/**
 * Record a completed puzzle attempt. Keeps top scores per
 * island + story + difficulty (fewest moves, then newest).
 */
export function recordPuzzleScore(entry: {
  islandId: string;
  storyId?: string;
  difficulty: PuzzleDifficulty;
  moves: number;
  stars: 1 | 2 | 3;
  name?: string;
}): PuzzleScoreEntry[] {
  const storyId = entry.storyId || '';
  const key = boardKey(entry.islandId, storyId, entry.difficulty);
  const next: PuzzleScoreEntry = {
    islandId: entry.islandId,
    storyId,
    difficulty: entry.difficulty,
    moves: entry.moves,
    stars: entry.stars,
    name: (entry.name || defaultPuzzlePlayerName()).trim() || 'Explorer',
    at: Date.now(),
  };

  const all = readAll();
  const others = all.filter(
    (e) => boardKey(e.islandId, e.storyId, e.difficulty) !== key,
  );
  const board = all
    .filter((e) => boardKey(e.islandId, e.storyId, e.difficulty) === key)
    .concat(next)
    .sort((a, b) => a.moves - b.moves || b.at - a.at)
    .slice(0, MAX_ENTRIES_PER_BOARD);

  writeAll([...others, ...board]);
  return board;
}

/** Top attempts for a puzzle board (fewest moves first). */
export function getPuzzleLeaderboard(
  islandId: string,
  storyId: string | undefined,
  difficulty: PuzzleDifficulty,
  limit = MAX_ENTRIES_PER_BOARD,
): PuzzleScoreEntry[] {
  const key = boardKey(islandId, storyId || '', difficulty);
  return readAll()
    .filter((e) => boardKey(e.islandId, e.storyId, e.difficulty) === key)
    .sort((a, b) => a.moves - b.moves || b.at - a.at)
    .slice(0, limit);
}
