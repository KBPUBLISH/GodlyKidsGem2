/**
 * Bible Map word-hunt star ranking.
 *
 * Stars are scored against the WHOLE story, not just the pages the kid
 * happened to visit:
 *   - `totalWords`   — missing-word targets across every story page
 *   - `correctWords` — targets the kid actually revealed (in order)
 *   - `wrongTaps`    — wrong chip / out-of-order taps this session
 *   - `huntPageCount`— pages with targets (scales the mistake allowance)
 *
 * Thresholds:
 *   3★  every missing word found, at most 1 wrong tap
 *   2★  every missing word found, avg wrongs/hunt-page ≤ 2
 *   1★  finished with many mistakes, or didn't fill every word
 *       (partial completion — e.g. resuming near the end — never
 *       scores above 1★, still celebrated for finishing the book)
 */

export type HuntStarRating = 1 | 2 | 3;

export interface HuntStarInput {
  /** Missing-word targets across ALL story pages. */
  totalWords: number;
  /** Targets the kid revealed correctly (in order). */
  correctWords: number;
  /** Wrong chip / out-of-order taps this session. */
  wrongTaps: number;
  /** Pages that contain at least one hunt target. */
  huntPageCount: number;
}

export function computeHuntStars({
  totalWords,
  correctWords,
  wrongTaps,
  huntPageCount,
}: HuntStarInput): HuntStarRating {
  const total = Math.max(0, Math.floor(totalWords));
  const correct = Math.min(total, Math.max(0, Math.floor(correctWords)));
  const wrongs = Math.max(0, Math.floor(wrongTaps));

  // No hunt content — nothing to score against.
  if (total === 0) return 3;

  // Incomplete word-fill (skipped pages, resumed mid-book, …) caps at 1★.
  if (correct < total) return 1;

  if (wrongs <= 1) return 3;

  const pages = Math.max(1, Math.floor(huntPageCount) || 1);
  if (wrongs / pages <= 2) return 2;

  return 1;
}
