import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleKey, ringAround, isOutlineDone, wantsGardenAsk, GARDEN_CAP } from '../src/garden-plan.mjs';
import {
  footprintKeys, stableOnEdge, fenceFromTaps, extendFence, gardenPlanFromTaps,
  canOffer, rowSlotMismatch, isSnoozed, snoozeUntil, buildAskLine, fenceAskLine, gardenAskLine, FENCE_CAP, isStructure,
} from '../src/build-ask.mjs';

test('garden taps toggle up to 20 and the ring follows that shape', () => {
  let keys = [];
  keys = toggleKey(keys, '4:4', GARDEN_CAP);
  keys = toggleKey(keys, '5:4', GARDEN_CAP);
  keys = toggleKey(keys, '4:4', GARDEN_CAP);
  assert.deepEqual(keys, ['5:4']);
  keys = toggleKey(['5:4'], '5:4');
  assert.deepEqual(keys, []);
  const full = Array.from({ length: 20 }, (_, i) => `1:${i}`);
  assert.equal(toggleKey(full, '9:9', GARDEN_CAP).length, 20);
  const ring = ringAround(['5:5', '6:5']);
  assert.ok(ring.includes('4:5') && ring.includes('7:5') && ring.includes('5:4') && ring.includes('5:6'));
  assert.ok(!ring.includes('5:5') && !ring.includes('6:5'));
  const plan = gardenPlanFromTaps(['5:5', '6:5'], { col: 0, row: 0 });
  assert.equal(plan.gate, '4:4');
  assert.equal(isOutlineDone(plan, ['5:5'], []), false);
  assert.equal(isOutlineDone(plan, ['5:5', '6:5'], plan.ring.filter(k => k !== plan.gate)), true);
});

test('a finished outline asks again; a half-planted garden does not; Not now waits until morning', () => {
  assert.equal(wantsGardenAsk({ plots: 0, planted: 0, hour: 10 }), true);
  assert.equal(wantsGardenAsk({ plots: 6, planted: 1, hour: 10 }), false);
  assert.equal(wantsGardenAsk({ plots: 6, planted: 6, hour: 10 }), true);
  assert.equal(wantsGardenAsk({ outline: { done: false, keys: ['1:1'] }, plots: 6, planted: 6, hour: 10 }), false);
  assert.equal(wantsGardenAsk({ outline: { done: true }, hour: 10 }), true);
  assert.equal(wantsGardenAsk({ plots: 0, hour: 22 }), false);
  const until = snoozeUntil(480);
  assert.ok(until > 480);
  assert.equal(isSnoozed(until, 500), true);
  assert.equal(isSnoozed(until, until), false);
});

test('Noah slides one footprint; Adam\'s first tap holds the stable and the loop caps at 24', () => {
  const fp = footprintKeys('10:8', [3, 2], 0);
  assert.deepEqual(fp.keys, ['10:8', '11:8', '12:8', '10:9', '11:9', '12:9']);
  const turned = footprintKeys('10:8', [3, 2], 1);
  assert.equal(turned.w, 2);
  assert.equal(turned.h, 3);
  const taps = ['3:3', '4:3', '5:3', '5:4', '5:5', '4:5', '3:5', '3:4'];
  const fence = fenceFromTaps(taps);
  assert.equal(fence.first, '3:3');
  assert.ok(fence.stable.keys.includes('3:3'));
  assert.equal(fence.gate, '3:4');
  assert.ok(fence.inside.length > 0);
  const more = extendFence(fence, ['6:3', '6:4', '6:5']);
  assert.ok(more.ring.includes('6:3'));
  assert.equal(more.stable.key, fence.stable.key);
  assert.equal(more.gate, '6:5');
  assert.equal(toggleKey(Array.from({ length: FENCE_CAP }, (_, i) => `0:${i}`), '1:1', FENCE_CAP).length, FENCE_CAP);
});

test('one ask at a time, and a camp-row mismatch is not a refusal of the building', () => {
  assert.equal(canOffer({}), true);
  assert.equal(canOffer({ open: true }), false);
  assert.equal(canOffer({ mealOpen: true }), false);
  assert.equal(canOffer({ snoozed: true }), false);
  assert.equal(rowSlotMismatch({ ok: false, reason: 'No room in the row yet', instead: 'No room in the row yet' }), true);
  assert.equal(rowSlotMismatch({ ok: false, reason: 'goal', instead: 'Camp still needs a Small Hut' }), false);
  assert.equal(rowSlotMismatch({ ok: true }), false);
  assert.equal(gardenAskLine(), 'Where would you like the garden to grow?');
  assert.equal(buildAskLine('Small Hut'), 'Where should I build the Small Hut?');
  assert.equal(fenceAskLine(), 'Where should the stable fence go?');
  assert.equal(isStructure('hut'), true);
  assert.equal(isStructure('fence'), false);
  assert.equal(isStructure('market'), true);
});

test('the stable footprint prefers the first tapped edge', () => {
  const stable = stableOnEdge('8:4', ['8:4', '9:4', '10:4', '10:5', '8:5'], [3, 2]);
  assert.ok(stable.keys.includes('8:4'));
  assert.equal(stable.keys.filter(k => k !== '8:4' && ['9:4', '10:4', '10:5', '8:5'].includes(k)).length <= 2, true);
});
