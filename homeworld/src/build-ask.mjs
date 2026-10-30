// Shared rules for the three "show me where" asks.
// Voices are the canon lines in characters.mjs: Abel soft and short, Noah
// hands-on ("where should I build"), Adam a simple question.
// Eve's meal ask is not this file.
import { nextMorning } from './farm-rules.mjs';
import { GARDEN_CAP, ringAround, pickGate, toggleKey } from './garden-plan.mjs';

export { GARDEN_CAP };
export const FENCE_CAP = 24;

/** Strokes and yard pieces are not "a building Noah places". */
const NOT_A_STRUCTURE = new Set(['fence', 'brick_fence', 'path', 'scarecrow', 'trough', 'feed_pile']);

export const isStructure = kind => !!kind && !NOT_A_STRUCTURE.has(kind);

export function gardenAskLine() {
  return 'Where would you like the garden to grow?';
}
export function buildAskLine(buildingName) {
  const name = String(buildingName || 'building').trim() || 'building';
  return `Where should I build the ${name}?`;
}
export function fenceAskLine() {
  return 'Where should the stable fence go?';
}

/** "Not now" waits until the next island morning (07:00), not the next minute. */
export const snoozeUntil = minutes => nextMorning(minutes);
export const isSnoozed = (until, minutes) => Number.isFinite(until) && minutes < until;

/** One card at a time. A meal ask already on screen counts as the open card. */
export function canOffer({ open = false, picking = false, mealOpen = false, snoozed = false } = {}) {
  return !open && !picking && !mealOpen && !snoozed;
}

/**
 * Foreman check-in rejected the kid's grass because it is not the camp row slot.
 * Goal, one-of-a-kind, and lane failures are different reasons and stay refusals.
 */
export function rowSlotMismatch(head) {
  if (!head || head.ok) return false;
  return head.reason === 'No room in the row yet' || head.instead === 'No room in the row yet';
}

/** Slide a building's footprint so `anchor` is its corner. `size` is [w, h]. */
export function footprintKeys(anchor, size, rotation = 0) {
  const [col, row] = String(anchor || '').split(':').map(Number);
  const w0 = size?.[0] || 1, h0 = size?.[1] || 1;
  const [w, h] = rotation % 2 ? [h0, w0] : [w0, h0];
  if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
  const keys = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) keys.push(`${col + c}:${row + r}`);
  return { key: `${col}:${row}`, rotation: rotation % 2, w, h, keys };
}

/**
 * The stable sits on the edge the kid tapped first: its footprint covers that
 * tile and as few of the other fence tiles as it can.
 */
export function stableOnEdge(firstKey, fenceKeys, size = [3, 2]) {
  const fence = new Set(fenceKeys || []);
  const [c, r] = String(firstKey || '').split(':').map(Number);
  if (!Number.isFinite(c) || !Number.isFinite(r)) return null;
  const [bw, bh] = size;
  let best = null;
  for (const rotation of [0, 1]) {
    const [fw, fh] = rotation % 2 ? [bh, bw] : [bw, bh];
    for (let dc = 0; dc < fw; dc++) for (let dr = 0; dr < fh; dr++) {
      const col = c - dc, row = r - dr;
      const spot = footprintKeys(`${col}:${row}`, size, rotation);
      if (!spot?.keys.includes(firstKey)) continue;
      const onFence = spot.keys.filter(k => fence.has(k) && k !== firstKey).length;
      if (!best || onFence < best.score) best = { ...spot, score: onFence };
    }
  }
  return best;
}

/** Cells a closed fence loop wraps. An open line has no interior. */
export function interiorOf(wallKeys) {
  const wall = [...(wallKeys || [])];
  if (wall.length < 4) return [];
  const pts = wall.map(k => k.split(':').map(Number)).filter(([c, r]) => Number.isFinite(c) && Number.isFinite(r));
  if (pts.length < 4) return [];
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const [c, r] of pts) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
  c0 -= 1; c1 += 1; r0 -= 1; r1 += 1;
  const blocked = new Set(wall);
  const seen = new Set();
  const stack = [[c0, r0]];
  while (stack.length) {
    const [c, r] = stack.pop();
    if (c < c0 || c > c1 || r < r0 || r > r1) continue;
    const key = `${c}:${r}`;
    if (seen.has(key) || blocked.has(key)) continue;
    seen.add(key);
    stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  const inside = [];
  for (let r = r0 + 1; r < r1; r++) for (let c = c0 + 1; c < c1; c++) {
    const key = `${c}:${r}`;
    if (!seen.has(key) && !blocked.has(key)) inside.push(key);
  }
  return inside;
}

/**
 * Adam's paddock from the taps, in order. First tap is the stable's edge.
 * The last tap that is not under the stable is the gate (placed last).
 */
export function fenceFromTaps(keys, size = [3, 2]) {
  const taps = [...(keys || [])];
  if (!taps.length) return null;
  const first = taps[0];
  const stable = stableOnEdge(first, taps, size);
  const covered = new Set(stable?.keys || []);
  const ring = taps.filter(k => !covered.has(k));
  const gate = [...ring].reverse()[0] || null;
  const wall = gate ? [...ring.filter(k => k !== gate), gate] : ring;
  return {
    keys: taps,
    first,
    ring,
    gate,
    inside: interiorOf([...wall, ...(stable?.keys || [])]),
    stable: stable ? { key: stable.key, rotation: stable.rotation, keys: stable.keys } : null,
  };
}

/** A later outline adds tiles. The stable stays. The newest last tap becomes the gate. */
export function extendFence(prev, taps, size = [3, 2]) {
  const added = (taps || []).filter(k => k && !prev?.keys?.includes(k) && !prev?.ring?.includes(k));
  const keys = [...new Set([...(prev?.keys || []), ...(prev?.ring || []), ...added])];
  const stableKeys = new Set(prev?.stable?.keys || []);
  const ring = keys.filter(k => !stableKeys.has(k));
  const gate = [...added].reverse().find(k => ring.includes(k)) || (ring.includes(prev?.gate) ? prev.gate : null) || ring[ring.length - 1] || null;
  return {
    keys,
    first: prev?.first || keys[0],
    ring,
    gate,
    inside: interiorOf([...(ring || []), ...(prev?.stable?.keys || [])]),
    stable: prev?.stable || stableOnEdge(keys[0], keys, size),
  };
}

export function gardenPlanFromTaps(keys, toward) {
  const plots = [...(keys || [])].slice(0, GARDEN_CAP);
  if (!plots.length) return null;
  const ring = ringAround(plots);
  return { keys: plots, ring, gate: pickGate(ring, toward), done: false };
}

export { toggleKey, ringAround, pickGate };
