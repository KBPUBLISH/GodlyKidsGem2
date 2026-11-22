/**
 * Island year label. The saved day stays monotonic (timeLabel's 1-based day, from clock minutes).
 * Only this label changes: days 1–364 are year 0, and year 1 starts when the count reaches 365.
 * After that the day runs 1–365 inside year 1 and wraps back to Yr 1 · Day 1. The year never becomes 2.
 *
 * displayed day for year 1 = ((absoluteDay - 365) % 365) + 1
 */
export const YEAR_DAYS = 365;
/** Absolute day that first reads Yr 1 · Day 1. Days before this are Yr 0. */
export const YEAR_ONE_START = 365;

/** 1-based absolute island day → {year, day} shown on the HUD. */
export function yearClock(absoluteDay) {
  const n = Math.max(1, Math.floor(Number(absoluteDay) || 1));
  if (n < YEAR_ONE_START) return {year: 0, day: n};
  return {year: 1, day: ((n - YEAR_ONE_START) % YEAR_DAYS) + 1};
}

/** Day number on the HUD. Year 0 uses the absolute day; year 1 wraps inside 1–365. */
export function displayedDay(absoluteDay) {
  return yearClock(absoluteDay).day;
}

/** HUD clock day portion, e.g. "Yr 0 · Day 337" or "Yr 1 · Day 1". */
export function yearClockLabel(absoluteDay) {
  const {year, day} = yearClock(absoluteDay);
  return `Yr ${year} · Day ${day}`;
}
