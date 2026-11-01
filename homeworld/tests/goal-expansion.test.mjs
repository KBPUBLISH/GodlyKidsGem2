import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workPoint} from '../src/building.mjs';
import {initialState,applyAction} from '../src/core.mjs';
import {goalFacts,restoreGoals,chooseGoal,advanceGoal,availableGoals} from '../src/adventure-goals.mjs';
import {farmFresh,farmBuy,farmOffer,farmRestore,farmCollect} from '../src/living-farm-rules.mjs';
const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
test('old catch progress survives extension and offers the cooking continuation',()=>{
 const s=restoreGoals({version:1,records:{fish:{base:{},progress:[1],completed:true}},celebrate:'fish'});
 assert.deepEqual(s.records.fish.progress,[1,0,0,0]);assert.equal(s.celebrate,null);
 assert.ok(availableGoals(s,{}).some(g=>g.id==='fish'));
});
test('grill goal accepts prepared fish, requires eating or sharing, and ignores other snacks',()=>{
 const facts=goalFacts({inventory:{cooked_fish:1}});
 let g=advanceGoal(chooseGoal(null,'fish',facts),facts);
 assert.deepEqual(g.records.fish.progress,[1,1,1,0]);
 g=advanceGoal(g,{...facts,mealsEaten:100});assert.equal(g.active,'fish');
 g=advanceGoal(g,{...facts,fishEnjoyed:1});assert.equal(g.celebrate,'fish');
});
test('sharing consumes one real fish once, feeds a known friend, and rejects missing recipients',()=>{
 const s=initialState(world);s.clock.paused=true;s.inventory.cooked_fish=1;s.characters.you={name:'Explorer',energy:50};s.activeCharacter='you';
 const a={type:'share_fish',recipient:'adam',actionId:'share-one'};
 const n=applyAction(s,a,world,480);assert.equal(n.inventory.cooked_fish,0);assert.equal(n.stats.fishShared,1);
 assert.equal(applyAction(n,a,world,480),n);
 assert.equal(applyAction(s,{...a,recipient:'missing'},world,480),s);
 assert.equal(applyAction(s,{...a,recipient:'you'},world,480),s);
 let g=chooseGoal(null,'fish',goalFacts(s));g=advanceGoal(g,goalFacts(n));assert.equal(g.celebrate,'fish');
});
test('eating a grilled fish completes the alternate branch; unrelated food does not',()=>{
 const s=initialState(world);s.clock.paused=true;s.inventory.cooked_fish=1;s.characters.adam.energy=40;s.characters.adam.hunger=20;
 const n=applyAction(s,{type:'eat',item:'cooked_fish',actionId:'eat-fish'},world,480);
 assert.equal(n.stats.fishEaten,1);assert.equal(goalFacts(n).fishEnjoyed,1);
});
test('a coop must be built first, holds three chickens, and upgrades without losing animals',()=>{
 let s={...farmFresh(),coins:100};assert.match(farmOffer(s,'chicken').reason,/coop first/);assert.equal(farmBuy(s,'chicken','',0),s);
 assert.equal(farmOffer(s,'coop').capacity,3);s=farmBuy(s,'coop','',0);assert.equal(s.coop,1);
 for(let i=0;i<3;i++)s=farmBuy(s,'chicken','',0);
 assert.equal(s.animals.length,3);assert.match(farmOffer(s,'chicken').reason,/bigger/);
 assert.equal(farmBuy(s,'chicken','',0),s);
 const migrated=farmRestore({...s,coop:0});assert.equal(migrated.coop,1);assert.equal(migrated.animals.length,3);
 const ready={...s,animals:s.animals.map((a,i)=>({...a,ready:i===0?2:0}))};
 assert.equal(farmCollect(ready,ready.animals[0].id,100).eggsCollected,2);
});
test('completing a goal exposes more activities and chicken goals unlock in order',()=>{
 let s=advanceGoal(chooseGoal(null,'wood',{}),{trees:3});s=advanceGoal(s,{trees:3,mealsEaten:1});
 assert.ok(availableGoals(s,{}).length>3);assert.ok(!availableGoals(s,{}).some(g=>g.id==='flock'));
 s=advanceGoal(chooseGoal(s,'chicken',{}),{coop:1,chickens:1});
 assert.ok(availableGoals(s,{}).some(g=>g.id==='flock'));assert.ok(availableGoals(s,{}).some(g=>g.id==='eggs'));
});

test('real cooking consumes the catch at a lit campfire and advances to the meal choice',()=>{
 const s=initialState(world),fire={id:'fire-test',kind:'campfire',key:'67:73',rotation:0,status:'complete',baseHeight:0,startedAt:0,paidMaterials:{pine_wood:5,stone:3},fuelUntil:1000};
 s.clock.paused=true;s.buildings=[fire];s.player=workPoint(world,fire);s.inventory.fish=1;
 const goal=advanceGoal(chooseGoal(null,'fish',goalFacts(s)),goalFacts(s));
 const action={type:'cook',recipe:'grill_fish',fireId:fire.id,actionId:'cook-once'};
 const n=applyAction(s,action,world,480);assert.equal(n.inventory.fish,0);assert.equal(n.inventory.cooked_fish,1);
 assert.deepEqual(advanceGoal(goal,goalFacts(n)).records.fish.progress,[1,1,1,0]);
 assert.equal(applyAction(n,action,world,480),n);
});
