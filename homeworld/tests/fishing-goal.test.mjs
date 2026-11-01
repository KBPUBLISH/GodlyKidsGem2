import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,applyAction} from '../src/core.mjs';
import {fishingDockLayout} from '../src/fishing-dock.mjs';
import {restoreGoals,chooseGoal,advanceGoal,goalFacts} from '../src/adventure-goals.mjs';
const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
function atPier(along=3.9,across=.4){
 const s=initialState(world),dock=fishingDockLayout(world);s.clock.paused=true;
 s.player={x:dock.sx+dock.dx*along-dock.dy*across,y:dock.sy+dock.dy*along+dock.dx*across};
 s.adventureGoals=chooseGoal(restoreGoals(null),'fish',goalFacts(s));return s;
}
test('a landed fish from the seaward pier reaches the bag, stats and active goal once',()=>{
 const s=atPier(),a={type:'fish',spotId:world.fishingSpots[0].id,actionId:'pier-catch'};
 const next=applyAction(s,a,world,480);
 assert.notEqual(next,s);assert.equal(next.inventory.fish,1);assert.equal(next.stats.fishCaught,1);
 assert.equal(next.characters.adam.energy,s.characters.adam.energy-4);
 const goals=advanceGoal(next.adventureGoals,goalFacts(next));
 assert.equal(goals.records.fish.progress[0],1);assert.equal(goals.records.fish.completed,false);assert.equal(goals.active,'fish');
 assert.equal(applyAction(next,a,world,480),next);
 assert.equal(advanceGoal(restoreGoals(JSON.parse(JSON.stringify(goals))),goalFacts(next)).active,'fish');
});
test('shore catches still work; invalid spots and positions outside the pier stay rejected',()=>{
 const s=atPier(0,0),a={type:'fish',spotId:world.fishingSpots[0].id,actionId:'shore-catch'};
 assert.equal(applyAction(s,a,world,480).stats.fishCaught,1);
 const outside=atPier(3.9,2);assert.equal(applyAction(outside,a,world,480),outside);
 assert.equal(applyAction(s,{...a,spotId:'missing'},world,480),s);
});
test('a rejected or failed save never announces a successful catch',async()=>{
 const {bankFishingCatch}=await import('../src/fishing-catch.mjs');
 for(const fail of [false,true]){
  const messages=[],state=atPier();
  const f={caught:0,target:1,a:{},spot:world.fishingSpots[0],g:{store:{state,commit(){if(fail)throw Error('storage unavailable');}},toast:text=>messages.push(text),notify(){}}};
  assert.equal(bankFishingCatch(f),false);assert.equal(f.caught,0);assert.equal(f.a.caughtAny,undefined);
  assert.equal(messages.some(m=>m.startsWith('Caught a fish!')),false);
 }
});
