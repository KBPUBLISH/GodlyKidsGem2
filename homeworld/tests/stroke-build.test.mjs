import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction, initialState} from '../src/core.mjs';
import {buildingById, layerCount, validBuildings} from '../src/building.mjs';

function flatWorld(){
  const columns=12, rows=12;
  const mask=Array(columns*rows).fill(2);
  mask[2]=0;
  const heights=Array((columns+1)*(rows+1)).fill(0);
  return {id:'flat', grid:{origin:[0,0], columns, rows, mask, heights}, gardenSlots:[], blockers:[], seeds:[], trees:[], boulders:[], heroStart:[.5,.5], fishingSpots:[]};
}
function ready(){
  const state=initialState(flatWorld(), 1_000);
  state.inventory.oak_wood=40;
  state.inventory.concrete_brick=10;
  state.player={x:.5,y:.5};
  return state;
}
const world=flatWorld();
function place(state, kind, key, id){
  return applyAction(state, {type:'place_building', id, kind, key, rotation:0, stroke:true, actionId:`place:${id}`}, world, 480);
}
function stack(state, id, n){
  return applyAction(state, {type:'stack_piece', id, actionId:`stack:${id}:${n}`}, world, 480);
}

test('a brick row spends one brick per piece and stays in build mode data', ()=>{
  let state=ready();
  state=place(state, 'brick_fence', '5:5', 'a');
  state=place(state, 'brick_fence', '6:5', 'b');
  state=place(state, 'brick_fence', '7:5', 'c');
  assert.equal(state.inventory.concrete_brick, 7);
  assert.equal(state.buildings.filter(b=>b.kind==='brick_fence'&&b.status==='complete').length, 3);
  assert.equal(state.buildings.find(b=>b.id==='b').rotation, 0);
  assert.equal(validBuildings(state.buildings, world), true);
  assert.equal(state.characters.adam.energy, 100-15);
});

test('bricks stack to 3 and the fourth layer is refused', ()=>{
  let state=ready();
  state=place(state, 'brick', '5:6', 'wall');
  state=stack(state, 'wall', 2);
  state=stack(state, 'wall', 3);
  const wall=state.buildings.find(b=>b.id==='wall');
  assert.equal(layerCount(wall), 3);
  assert.equal(wall.paidMaterials.concrete_brick, 3);
  const stuck=stack(state, 'wall', 4);
  assert.equal(stuck, state);
  assert.equal(layerCount(wall), 3);
  assert.equal(validBuildings(state.buildings, world), true);
});

test('a wood fence stays one high and a north piece turns', ()=>{
  let state=ready();
  state=place(state, 'fence', '5:7', 'w1');
  state=place(state, 'fence', '5:8', 'w2');
  const refused=stack(state, 'w1', 2);
  assert.equal(refused, state);
  assert.equal(state.buildings.find(b=>b.id==='w1').layers, undefined);
  assert.equal(state.buildings.find(b=>b.id==='w2').rotation, 1);
  assert.equal(state.buildings.find(b=>b.id==='w1').rotation, 1);
  assert.equal(state.inventory.oak_wood, 36);
});

test('a short bag and water do not place a piece', ()=>{
  let state=ready();
  state.inventory.concrete_brick=0;
  const broke=place(state, 'brick_fence', '5:5', 'nope');
  assert.equal(broke, state);
  state=ready();
  const wet=place(state, 'brick', '2:0', 'wet');
  assert.equal(wet, state);
  assert.equal(buildingById('brick').bundle.concrete_brick, 1);
  assert.equal(buildingById('brick_fence').bundle.concrete_brick, 1);
  assert.equal(buildingById('fence').wood, 2);
  assert.equal(buildingById('fence').stack, undefined);
  assert.equal(buildingById('brick').stack, 3);
});
