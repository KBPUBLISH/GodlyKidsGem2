/** Beds on finished homes. Keep in step with homeworld/src/building.mjs. */
const BEDS = { hut: 2, cottage: 4, townhouse: 8, tent: 1 };

/** Finished homes are the only beds a new friend needs. */
export function islandBedCount(save) {
  const buildings = Array.isArray(save?.buildings) ? save.buildings : [];
  return buildings.reduce((total, building) => {
    if (!building || building.status !== 'complete') return total;
    return total + (BEDS[building.kind] || 0);
  }, 0);
}

/**
 * The first friend can always come ashore. After that, every friend needs a bed.
 * Same rule as Residents.bedStatus in homeworld/src/residents.js.
 */
export function islandHasRoom(residentCount, bedCount) {
  const residents = Math.max(0, residentCount | 0);
  return residents === 0 || residents < Math.max(0, bedCount | 0);
}

function terrainAt(world, x, y) {
  const grid = world?.grid;
  if (!grid) return 0;
  const col = Math.floor(x - grid.origin[0]);
  const row = Math.floor(y - grid.origin[1]);
  if (col < 0 || row < 0 || col >= grid.columns || row >= grid.rows) return 0;
  return grid.mask[row * grid.columns + col] || 0;
}

function hitsCircle(x, y, circles) {
  for (const circle of circles) {
    if (!circle || !Number.isFinite(circle.x) || !Number.isFinite(circle.y)) continue;
    const radius = Number.isFinite(circle.r) ? circle.r : 0.8;
    if (Math.hypot(circle.x - x, circle.y - y) < radius) return true;
  }
  return false;
}

/**
 * Grass near `anchor` where a collected friend can stand.
 * Terrain 2 is grass. Trees, rocks, houses, and friends already living here are left clear.
 * @returns {{x:number,y:number}|null}
 */
export function grassStand(world, anchor, taken = [], avoid = []) {
  const hero = world?.heroStart;
  const base = Number.isFinite(anchor?.x) && Number.isFinite(anchor?.y)
    ? anchor
    : hero
      ? { x: hero[0], y: hero[1] }
      : null;
  if (!base || !world?.grid) return null;
  const circles = [];
  for (const tree of world.trees || []) {
    const position = tree?.position;
    if (!position) continue;
    circles.push({ x: position[0], y: position[1], r: (tree.radius || 0.4) + 0.7 });
  }
  for (const rock of world.boulders || []) {
    const position = rock?.position;
    if (!position) continue;
    circles.push({ x: position[0], y: position[1], r: (rock.radius || 0.4) + 0.6 });
  }
  for (const friend of taken) {
    if (Number.isFinite(friend?.x) && Number.isFinite(friend?.y)) circles.push({ x: friend.x, y: friend.y, r: 0.9 });
  }
  for (const spot of avoid) circles.push(spot);
  const blocked = (x, y) => terrainAt(world, x, y) < 2 || hitsCircle(x, y, circles);
  for (let i = 0; i < 64; i++) {
    const angle = i * 2.399963;
    const radius = 1.5 + (i % 8) * 0.5;
    const x = base.x + Math.cos(angle) * radius;
    const y = base.y + Math.sin(angle) * radius;
    if (!blocked(x, y)) return { x, y };
  }
  if (hero && !blocked(hero[0] + 1.4, hero[1])) return { x: hero[0] + 1.4, y: hero[1] };
  return null;
}
