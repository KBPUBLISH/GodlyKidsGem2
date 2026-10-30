// Eve's mealtime ask, while the kid is playing as her.
// Voice: characters.mjs — short, warm, practical, a little bossy about mealtimes,
// "everyone eats together". The "lol" shows up sometimes, not on every line.
import {MEALS} from './character-skills.mjs';

/** Island minutes to wait after "Not yet" before Eve asks again. */
export const ASK_AGAIN_MINUTES = 10;
/** A meal an hour past its bell is the stale bell: stop asking and skip it. */
export const STALE_AFTER_HOURS = 1;

const LINES = {
  breakfast: [
    n => `Hey ${n}, I gotta go make breakfast. Everyone eats together.`,
    n => `Hey ${n}, breakfast is calling. Let me get to the kitchen.`,
    n => `Hey ${n}, it's breakfast time lol. I should be ringing the bell.`,
  ],
  lunch: [
    n => `Hey ${n}, I gotta go make lunch. The bell won't ring itself.`,
    n => `Hey ${n}, lunch time. Mind if I go cook?`,
    n => `Hey ${n}, I gotta go make lunch lol. Everyone eats together.`,
  ],
  dinner: [
    n => `Hey ${n}, I gotta go make dinner lol.`,
    n => `Hey ${n}, dinner time. Everyone eats together, so I should get going.`,
    n => `Hey ${n}, I gotta go make dinner. The island is hungry.`,
  ],
};

/** First name of the active kid profile, or "friend" when the island cannot read one. */
export function kidFirstName() {
  try {
    if (typeof localStorage === 'undefined') return 'friend';
    const parsed = JSON.parse(localStorage.getItem('godly_kids_data_v6') || 'null');
    if (!parsed || typeof parsed !== 'object') return 'friend';
    const id = parsed.currentProfileId;
    if (!id) return 'friend';
    const kid = (parsed.kids || []).find(k => k && k.id === id);
    const first = String(kid?.name || '').trim().split(/\s+/)[0];
    if (!first || first.length > 24) return 'friend';
    return first;
  } catch {
    return 'friend';
  }
}

/** One of three lines for this meal. `variant` wraps so the same line does not repeat next. */
export function mealAskLine(mealId, name, variant = 0) {
  const meal = MEALS.find(m => m.id === mealId);
  const bank = LINES[mealId] || LINES.dinner;
  const who = String(name || '').trim() || 'friend';
  const line = bank[Math.abs(variant | 0) % bank.length](who);
  if (meal && mealId && !LINES[mealId]) return line.replace('dinner', meal.name.toLowerCase());
  return line;
}

/**
 * While the cook's body is the one being played (`actor === game.actor`).
 * `released` is set after "Go on" so this meal may proceed.
 * Returns kind: hold (before the bell), ask, showing, snooze, skip, cook.
 */
export function playedCookStep({hour, mealHour, minutes, mealId, ask, released}) {
  if (!(hour >= mealHour)) return {kind: 'hold'};
  if (hour >= mealHour + STALE_AFTER_HOURS) return {kind: 'skip'};
  if (released) return {kind: 'cook'};
  const same = ask && ask.mealId === mealId ? ask : null;
  if (same?.open) return {kind: 'showing'};
  if (same && minutes < same.againAt) return {kind: 'snooze'};
  const variant = same ? (same.variant + 1) % 3 : 0;
  return {kind: 'ask', variant};
}
