/**
 * Bible Map word-hunt star ranking.
 *
 * Scoring is based on incorrect taps (wrong chip / out-of-order blank)
 * averaged across pages that have hunt targets:
 *   3★  avg wrongs/hunt-page ≤ 1
 *   2★  avg wrongs/hunt-page ≤ 2.5
 *   1★  more mistakes (still celebrate finishing)
 */

export type HuntStarRating = 1 | 2 | 3;

export function computeHuntStars(
  wrongTaps: number,
  huntPageCount: number,
): HuntStarRating {
  const pages = Math.max(1, huntPageCount);
  const wrongs = Math.max(0, Math.floor(wrongTaps));
  const avg = wrongs / pages;
  if (avg <= 1) return 3;
  if (avg <= 2.5) return 2;
  return 1;
}
