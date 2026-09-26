/**
 * Mirrored from the kid app (`utils/slidingPuzzle.ts`).
 * Keep scramble + background-position logic in sync so portal previews match production.
 */

export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';

/** Grid size (N×N) per difficulty. Full board — every cell is an image tile. */
export const GRID_SIZE_BY_DIFFICULTY: Record<PuzzleDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

/**
 * Board values: image tile ids `0..N²−1` in cell order.
 * Solved when `board[i] === i` for every index (tile id matches its home cell).
 * Play mode: tap two cells to swap their tiles (no empty slots).
 */
export type Board = number[];

export function solvedBoard(size: number): Board {
  const n = size * size;
  return Array.from({ length: n }, (_, i) => i);
}

/** Swap tiles at two cell indexes. Returns a new board, or null if illegal. */
export function swapTiles(
  board: Board,
  a: number,
  b: number,
): Board | null {
  const n = board.length;
  if (a < 0 || b < 0 || a >= n || b >= n || a === b) return null;
  const next = board.slice();
  const tmp = next[a];
  next[a] = next[b];
  next[b] = tmp;
  return next;
}

/** Win when every tile id sits in its matching grid cell. */
export function isSolved(board: Board): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== i) return false;
  }
  return board.length > 0;
}

/** Default scramble depth for animation (~1s of visible swaps). */
export function scrambleMoveCountForAnimation(size: number): number {
  return size <= 3 ? 18 : size === 4 ? 22 : 26;
}

/**
 * Scramble as board frames: solved first, then one random swap per step.
 * Always solvable (any permutation can be undone by swaps).
 */
export function scrambleSequence(size: number, moveCount?: number): Board[] {
  const moves = moveCount ?? scrambleMoveCountForAnimation(size);
  const frames: Board[] = [];
  let board = solvedBoard(size);
  frames.push(board.slice());
  const n = size * size;
  let lastA = -1;
  let lastB = -1;

  for (let i = 0; i < moves; i++) {
    let a = Math.floor(Math.random() * n);
    let b = Math.floor(Math.random() * n);
    // Avoid no-op and immediate reverse of the previous swap when possible
    let guard = 0;
    while (
      (a === b ||
        (a === lastB && b === lastA) ||
        (a === lastA && b === lastB)) &&
      guard < 24
    ) {
      a = Math.floor(Math.random() * n);
      b = Math.floor(Math.random() * n);
      guard += 1;
    }
    if (a === b) {
      b = (a + 1) % n;
    }
    const next = swapTiles(board, a, b);
    if (next) {
      lastA = a;
      lastB = b;
      board = next;
      frames.push(board.slice());
    }
  }

  // Avoid starting already solved
  if (isSolved(board) && n >= 2) {
    const nudged = swapTiles(board, 0, 1);
    if (nudged) {
      board = nudged;
      frames.push(board.slice());
    }
  }

  return frames;
}

/**
 * Scramble via random swaps from the solved state.
 * Guarantees the puzzle can be solved by swapping.
 */
export function scrambleBoard(size: number, moveCount?: number): Board {
  const frames = scrambleSequence(
    size,
    moveCount ?? (size <= 3 ? 40 : size === 4 ? 80 : 120),
  );
  return frames[frames.length - 1] ?? solvedBoard(size);
}

/** CSS background-position for tile `tileId` on an N×N grid (0 = top-left). */
export function tileBackgroundPosition(tileId: number, size: number): string {
  const row = Math.floor(tileId / size);
  const col = tileId % size;
  const pct = size === 1 ? 0 : 100 / (size - 1);
  return `${col * pct}% ${row * pct}%`;
}

export function parseDifficulty(
  value: string | null | undefined,
  fallback: PuzzleDifficulty = 'easy',
): PuzzleDifficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return fallback;
}

/**
 * Star thresholds by difficulty (moves to earn each star tier).
 * Tuned vs scramble depth (easy≈18, medium≈22, hard≈26 visible swaps):
 * 3★ = efficient solve (better than reverse-scramble), 2★ = typical, else 1★.
 * - easy 3×3:  3★ ≤12, 2★ ≤20
 * - medium 4×4: 3★ ≤30, 2★ ≤50
 * - hard 5×5:   3★ ≤60, 2★ ≤100
 */
export const STAR_THRESHOLDS: Record<
  PuzzleDifficulty,
  { three: number; two: number }
> = {
  easy: { three: 12, two: 20 },
  medium: { three: 30, two: 50 },
  hard: { three: 60, two: 100 },
};

/** Stars earned (1–3) from move count and difficulty. */
export function starsForMoves(
  moves: number,
  difficulty: PuzzleDifficulty,
): 1 | 2 | 3 {
  const t = STAR_THRESHOLDS[difficulty];
  if (moves <= t.three) return 3;
  if (moves <= t.two) return 2;
  return 1;
}
