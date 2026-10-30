// Abel's garden outline. The kid taps grass (up to 20). Abel fences around that
// shape and plants inside it. He does not invent a different block.
// Pure: no three.js. The runtime is garden-plan.js.

export const GARDEN_CAP = 20;

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export function parseKey(key) {
  const [col, row] = String(key).split(':').map(Number);
  return { col, row };
}

/** Add `key` or remove it. A full list stays put when the cap is already met. */
export function toggleKey(keys, key, cap = GARDEN_CAP) {
  const list = Array.isArray(keys) ? keys.filter(k => typeof k === 'string') : [];
  if (!key || typeof key !== 'string') return list;
  if (list.includes(key)) return list.filter(k => k !== key);
  if (list.length >= cap) return list;
  return [...list, key];
}

/**
 * Tiles one step outside the plots: edge neighbours, plus a corner post where
 * both adjacent edges are also outside. The shape of `keys` is the shape.
 */
export function ringAround(keys) {
  const plots = new Set(keys || []);
  const ring = [];
  const seen = new Set();
  const add = (k) => {
    if (plots.has(k) || seen.has(k)) return;
    seen.add(k);
    ring.push(k);
  };
  for (const key of plots) {
    const { col, row } = parseKey(key);
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    for (const [dc, dr] of ORTHO) add(`${col + dc}:${row + dr}`);
    for (const [dc, dr] of CORNERS) {
      if (plots.has(`${col + dc}:${row}`) || plots.has(`${col}:${row + dr}`)) continue;
      add(`${col + dc}:${row + dr}`);
    }
  }
  return ring;
}

/** The ring tile nearest camp, left open so friends can walk in. */
export function pickGate(ring, toward) {
  if (!ring?.length) return null;
  if (!toward) return ring[0];
  let best = ring[0], score = Infinity;
  for (const key of ring) {
    const { col, row } = parseKey(key);
    const d = Math.hypot(col - toward.col, row - toward.row);
    if (d < score) { score = d; best = key; }
  }
  return best;
}

/**
 * The outline is finished when every tapped plot has a seed and every ring
 * tile except the gate has a fence. Weeding is not part of this.
 */
export function isOutlineDone(outline, planted, fenced) {
  if (!outline?.keys?.length || outline.done) return !!outline?.done;
  const grew = new Set(planted || []);
  const posts = new Set(fenced || []);
  if (!outline.keys.every(k => grew.has(k))) return false;
  const ring = (outline.ring || []).filter(k => k && k !== outline.gate);
  return ring.every(k => posts.has(k));
}

/**
 * Ask for another outline once the current one is planted and fenced, or when
 * there is no player outline yet and the garden he already has is planted.
 * `empty` is plots still waiting for a seed. A brand-new island (no plots, or
 * only the starter beds still empty) does not ask until those are in, unless
 * there is nothing planted and nothing to plant (`plots === 0`).
 */
export function wantsGardenAsk({ outline, plots = 0, planted = 0, night = false, hour = 12 } = {}) {
  if (night || hour < 6.5 || hour >= 20) return false;
  if (outline && !outline.done) return false;
  if (outline?.done) return true;
  if (!plots) return true;
  const empty = Math.max(0, plots - planted);
  return empty <= 1 && planted > 0;
}
