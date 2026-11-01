import { ringAround, pickGate } from './garden-plan.mjs';

const SHAPES = {
  square: { name: 'Little Square', friends: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  rows: { name: 'Three Rows', friends: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  corner: { name: 'Corner Garden', friends: 4, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  cross: { name: 'Grand Cross', friends: 5, cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]] },
};

export const GARDEN_PRESETS = Object.entries(SHAPES).flatMap(([shape, spec]) => [false, true].map(fenced => ({
  id: `${shape}-${fenced ? 'fenced' : 'open'}`,
  shape,
  name: `${spec.name}${fenced ? ' + Fence' : ''}`,
  friends: spec.friends,
  fenced,
  plots: spec.cells.length,
  cells: spec.cells,
})));

export function gardenPreset(id) {
  return GARDEN_PRESETS.find(p => p.id === id) || null;
}

export function placeGardenPreset(id, anchor, toward = null) {
  const preset = gardenPreset(id);
  const [col, row] = String(anchor || '').split(':').map(Number);
  if (!preset || !Number.isFinite(col) || !Number.isFinite(row)) return null;
  const keys = preset.cells.map(([dc, dr]) => `${col + dc}:${row + dr}`);
  const ring = preset.fenced ? ringAround(keys) : [];
  const gate = preset.fenced ? pickGate(ring, toward) : null;
  return {
    presetId: preset.id,
    name: preset.name,
    fenced: preset.fenced,
    requiredFriends: preset.friends,
    keys,
    ring,
    gate,
    wood: fenceWoodNeeded({ ring, gate }),
  };
}

export function fenceWoodNeeded(plan) {
  return Math.max(0, (plan?.ring || []).filter(key => key && key !== plan?.gate).length * 2);
}
