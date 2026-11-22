import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,applyAction,canPlow} from '../src/core.mjs';
import {energyCost,canAffordEnergy} from '../src/nutrition.mjs';
import {gatherSample} from '../src/gather-animation.js';
const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
test('tilling spends exactly three energy once and permits a child with three energy',()=>{
 for(const shovel of [0,1,2,3]){
  const s=initialState(world);s.tools.shovel=shovel;s.characters.adam.energy=3;
  const key=world.gardenSlots.find(p=>canPlow(world,s,p.key)).key;
  const action={type:'plow',key,actionId:`till-${shovel}`};
  assert.equal(energyCost(s,action),3);assert.equal(canAffordEnergy(s,action),true);
  const next=applyAction(s,action,world,480);
  assert.equal(next.characters.adam.energy,0);assert.equal(next.cells[key].soil,'tilled');assert.equal(next.stats.plowed,1);
  assert.equal(applyAction(next,action,world,480),next);
  s.characters.adam.energy=2;assert.equal(applyAction(s,{...action,actionId:'too-tired'},world,480),s);
 }
});
test('the shorter tilling swing still lands before returning to its resting pose',()=>{
 const start=gatherSample('plow',0,1,1),impact=gatherSample('plow',.9,1,1),end=gatherSample('plow',1.7,1,1);
 assert.ok(start.duration<2);assert.equal(start.due,0);assert.equal(impact.due,1);assert.equal(end.due,1);assert.equal(end.dip,0);
});
