import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction, buildPlacementStatus, buildSiteStatus, initialState, migrateState} from '../src/core.mjs';
import {collapsePrayerTents} from '../src/building.mjs';
import {goalDone, nextGoal} from '../src/settlement.mjs';

function flatWorld(){
  const columns=16, rows=16;
  const mask=Array(columns*rows).fill(2);
  const heights=Array((columns+1)*(rows+1)).fill(0);
  return {id:'flat', grid:{origin:[0,0], columns, rows, mask, heights}, gardenSlots:[], blockers:[], seeds:[], trees:[], boulders:[], heroStart:[.5,.5], fishingSpots:[]};
}
const world=flatWorld();
function tent(id, status='complete'){
  return {id, kind:'tent', key:'4:4', rotation:0, status, baseHeight:0, startedAt:1, paidMaterials:{oak_wood:8}};
}
function base(){
  const state=initialState(world, 1_000);
  state.inventory.oak_wood=40;
  state.inventory.stone=20;
  state.player={x:1, y:1};
  state.constructionVersion=1;
  return state;
}

test('a second Prayer Tent is refused even on a different spot, and wood stays in the bag', ()=>{
  const state=base();
  state.buildings=[tent('first')];
  const wood=state.inventory.oak_wood;
  const next=applyAction(state, {type:'place_building', id:'second', kind:'tent', key:'8:8', rotation:0, actionId:'place:second'}, world, 480);
  assert.equal(next, state);
  assert.equal(state.inventory.oak_wood, wood);
  assert.equal(state.buildings.length, 1);
  const status=buildPlacementStatus(world, state, {kind:'tent', key:'8:8', rotation:0}, 480);
  assert.equal(status.ok, false);
  assert.match(status.reason, /One Prayer Tent is enough/);
});

test('a footprint that overlaps a finished or in-progress building is rejected', ()=>{
  const state=base();
  state.buildings=[tent('first','building')];
  const same=buildSiteStatus(world, state, {kind:'hut', key:'4:4', rotation:0}, 480);
  assert.equal(same.ok, false);
  assert.match(same.reason, /already has that spot/);
  const beside=buildSiteStatus(world, state, {kind:'hut', key:'8:8', rotation:0}, 480);
  assert.equal(beside.ok, true);
});

test('one queued Prayer Tent completes the camp goal so the crew moves on', ()=>{
  const state=base();
  state.buildings=[tent('walking','queued')];
  assert.equal(goalDone(state, {kind:'tent'}), true);
  const goal=nextGoal(state, 'tent');
  assert.notEqual(goal?.kind, 'tent');
});

test('loading drops stacked Prayer Tents, keeps the first, and refunds nothing', ()=>{
  const state=base();
  state.buildings=[tent('keep'), tent('copy-a'), {id:'hut', kind:'hut', key:'10:10', rotation:0, status:'complete', baseHeight:0, startedAt:1, paidMaterials:{oak_wood:10, stone:5}}, tent('copy-b','queued')];
  state.characters.eve={name:'Eve', energy:80, sleep:{homeId:'copy-a'}};
  state.inventory.oak_wood=3;
  const next=migrateState(state);
  const tents=next.buildings.filter(b=>b.kind==='tent');
  assert.deepEqual(tents.map(b=>b.id), ['keep']);
  assert.equal(next.buildings.some(b=>b.kind==='hut'), true);
  assert.equal(next.inventory.oak_wood, 3);
  assert.equal(next.characters.eve.sleep.homeId, 'keep');
  assert.equal(collapsePrayerTents(next), next);
});
