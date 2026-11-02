import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KITCHEN_STATIONS,kitchenRoute,kitchenNextStation,kitchenCanWork} from '../src/kitchen-navigation.mjs';
import {COOKING_RECIPES,applyCooking} from '../src/cooking.mjs';
import {initialState} from '../src/core.mjs';

test('every station route keeps the chef clear of all counter footprints',()=>{
 for(const from of KITCHEN_STATIONS)for(const to of KITCHEN_STATIONS){
  let p={x:from.x,z:from.standZ};const path=kitchenRoute(p,to.id);
  for(const end of path){
   for(let i=0;i<=30;i++){
    const x=p.x+(end.x-p.x)*i/30,z=p.z+(end.z-p.z)*i/30;
    for(const counter of KITCHEN_STATIONS)assert.ok(Math.abs(x-counter.x)>1.55||Math.abs(z-counter.z)>1.04,`${from.id} → ${to.id} clips ${counter.id}`);
   }
   p=end;
  }
  assert.deepEqual(p,{x:to.x,z:to.standZ});
 }
});

const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
for(const recipe of COOKING_RECIPES)test(`${recipe.name}: station journey survives a reload and serves only when ready`,()=>{
 let state=initialState(world,1000);state.buildings=[{id:'kitchen',kind:'oven',status:'complete'}];Object.assign(state.inventory,{pumpkin:3,carrot:4,egg:4,fish:2,potato:4});
 assert.equal(kitchenNextStation(null,null),'pantry');
 state=applyCooking(state,{type:'cooking_start',recipe:recipe.id,ovenId:'kitchen',sequence:0},1000);
 for(const [i,step] of recipe.steps.entries()){
  // Saving and restoring a session does not depend on a transient chef position.
  state=JSON.parse(JSON.stringify(state));const session=state.cooking.session;
  assert.equal(kitchenNextStation(session,recipe),step.station);
  assert.equal(kitchenCanWork(step.station,true,session,recipe),false);
  assert.equal(kitchenCanWork('serve',false,session,recipe),false);
  assert.equal(kitchenCanWork(step.station,false,session,recipe),true);
  state=applyCooking(state,{type:'cooking_step',sessionId:session.id,step:i},2000);
 }
 const session=state.cooking.session;
 assert.equal(kitchenNextStation(session,recipe,false),recipe.steps.at(-1).station);
 assert.equal(kitchenCanWork('serve',false,session,recipe,false),false);
 assert.equal(applyCooking(state,{type:'cooking_collect',sessionId:session.id},session.readyAt-1),state);
 assert.equal(kitchenNextStation(session,recipe,true),'serve');
 assert.equal(kitchenCanWork('serve',true,session,recipe,true),false);
 assert.equal(kitchenCanWork('serve',false,session,recipe,true),true);
 state=applyCooking(state,{type:'cooking_collect',sessionId:session.id},session.readyAt);
 assert.equal(state.inventory[recipe.meal],1);
 assert.equal(kitchenNextStation(state.cooking.session,recipe),'serve');
 assert.equal(applyCooking(state,{type:'cooking_collect',sessionId:session.id},session.readyAt+1000),state);
});
