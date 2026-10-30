/**
 * Island year label. The saved day stays monotonic (timeLabel's 1-based day, from clock minutes).
 * Only this label wraps: the year stays 1, and the day runs 1–365 then starts again at Day 1.
 * displayedDay = ((absoluteDay - 1) % 365) + 1
 */
export const YEAR_DAYS = 365;
export const DISPLAY_YEAR = 1;

/** 1-based absolute island day → day-of-year shown on the HUD. Never advances the year. */
export function displayedDay(absoluteDay) {
  const n = Math.max(1, Math.floor(Number(absoluteDay) || 1));
  return ((n - 1) % YEAR_DAYS) + 1;
}

/** HUD clock day portion. Year is always 1. */
export function yearClockLabel(absoluteDay) {
  return `Yr ${DISPLAY_YEAR} · Day ${displayedDay(absoluteDay)}`;
}
