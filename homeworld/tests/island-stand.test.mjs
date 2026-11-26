import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grassStand, islandBedCount, islandHasRoom } from '../../shared/islandStand.mjs';

const world = JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json', import.meta.url)));

test('the first friend can stand before any home is built', () => {
  assert.equal(islandHasRoom(0, 0), true);
  assert.equal(islandHasRoom(1, 0), false);
  assert.equal(islandHasRoom(1, 1), false);
  assert.equal(islandHasRoom(1, 2), true);
  assert.equal(islandBedCount({ buildings: [{ kind: 'tent', status: 'complete' }, { kind: 'hut', status: 'queued' }] }), 1);
});

test('a collected friend stands on grass, clear of trees', () => {
  const hero = { x: world.heroStart[0], y: world.heroStart[1] };
  const spot = grassStand(world, hero, []);
  assert.ok(spot);
  const col = Math.floor(spot.x - world.grid.origin[0]);
  const row = Math.floor(spot.y - world.grid.origin[1]);
  assert.equal(world.grid.mask[row * world.grid.columns + col], 2);
  for (const tree of world.trees) {
    assert.ok(Math.hypot(tree.position[0] - spot.x, tree.position[1] - spot.y) >= (tree.radius || 0.4) + 0.7);
  }
  const second = grassStand(world, hero, [{ x: spot.x, y: spot.y }]);
  assert.ok(Math.hypot(second.x - spot.x, second.y - spot.y) >= 0.9);
});
