import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, collect, deliver, readyToDeliver, REQUESTS, PLAYER_ID } from '../src/quests.mjs';

test('only the player can gather or complete a friend request', () => {
  const state = freshState();
  assert.equal(collect(state, 'log-1', 'noah'), state);
  assert.equal(collect(state, 'carrot-1'), state);
  assert.equal(deliver(state, 'noah'), state);
  assert.equal(state.player.id, PLAYER_ID);
});

test('three logs are unique and must be handed to Noah before the next request', () => {
  let state = freshState();
  for (const id of ['log-1', 'log-2', 'log-3']) state = collect(state, id);
  assert.equal(collect(state, 'log-1'), state);
  assert.equal(readyToDeliver(state), true);
  assert.equal(deliver(state, 'eve'), state);
  assert.equal(deliver(state, 'noah', 'eve'), state);
  for(let i=0;i<3;i++) state = deliver(state, 'noah');
  assert.equal(state.stage, 1);
  assert.equal(state.inventory.wood, 0);
  assert.equal(deliver(state, 'noah'), state);
});

test('the complete sequence consumes supplies once and preserves player identity', () => {
  let state = freshState();
  const groups = [['log-1', 'log-2', 'log-3'], ['carrot-1', 'carrot-2', 'carrot-3', 'carrot-4'], ['flower-1', 'flower-2', 'flower-3']];
  for (const [i, ids] of groups.entries()) {
    ids.forEach(id => { state = collect(state, id); });
    ids.forEach(() => { state = deliver(state, REQUESTS[i].friend); });
  }
  assert.equal(state.stage, 3);
  assert.equal(state.player.id, PLAYER_ID);
  assert.deepEqual(state.inventory, { wood: 0, carrot: 0, flower: 0 });
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), state);
});

test('one carried log can be deposited early and partial delivery survives reload', () => {
  let state = collect(freshState(), 'log-1');
  state = deliver(state, 'noah');
  assert.equal(state.stage, 0);
  assert.equal(state.deposits.wood, 1);
  assert.equal(state.inventory.wood, 0);
  assert.equal(deliver(state, 'noah'), state);
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), state);
});

test('the earlier prototype save retains completed construction and supplies', () => {
  const old = { version: 1, stage: 1, homeWork: .6, gathered: ['log-1','log-2','log-3','carrot-1'], player: { x: 1, z: 2 } };
  const state = restoreState(old);
  assert.equal(state.stage, 1);
  assert.equal(state.deposits.wood, 3);
  assert.equal(state.inventory.carrot, 1);
  assert.equal(state.homeWork, .6);
  assert.deepEqual(state.player, { id: PLAYER_ID, x: 1, z: 2 });
});

test('invalid saves cannot inject inventory, control a friend, or skip milestones', () => {
  const state = restoreState({ version: 1, stage: 0, gathered: ['log-1', 'log-1', '__proto__', 'unknown'], inventory: { wood: 999 }, player: { id: 'noah', x: 900, z: -900 } });
  assert.deepEqual(state.gathered, ['log-1']);
  assert.equal(state.inventory.wood, 1);
  assert.equal(state.player.id, PLAYER_ID);
  assert.equal(state.player.x, 5.3);
  assert.deepEqual(restoreState({ version: 1, stage: 3, gathered: [] }), freshState());
});
