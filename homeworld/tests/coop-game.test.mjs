import test from 'node:test';
import assert from 'node:assert/strict';
import {farmFresh,farmBuy,farmAdvance,farmCollectEgg,farmRestore,FIRST_EGG_MS,FARM_CYCLE_MS} from '../src/living-farm-rules.mjs';
import {eggSlots,coopSurfaceHeight} from '../src/coop-layout.mjs';
import {goalFacts,chooseGoal,advanceGoal} from '../src/adventure-goals.mjs';
const ready=()=>farmAdvance(farmBuy({...farmFresh(),coop:1,coins:10},'chicken','Sunny',0),FIRST_EGG_MS+FARM_CYCLE_MS*3);
test('each nest tap banks one egg once; three taps advance the real egg goal',()=>{
 let s=ready(),g=advanceGoal(chooseGoal(null,'chicken',{}),{coop:1,chickens:1});g=chooseGoal(g,'eggs',{});
 const id=s.animals[0].id;assert.equal(s.animals[0].ready,3);
 for(const slot of [2,0,1]){const n=farmCollectEgg(s,id,slot,1000000);assert.equal(n.bag.egg,s.bag.egg+1);assert.equal(farmCollectEgg(n,id,slot,1000000),n);s=farmRestore(JSON.parse(JSON.stringify(n)));g=advanceGoal(g,goalFacts({livingFarm:s}));}
 assert.equal(s.bag.egg,3);assert.equal(s.animals[0].ready,0);assert.equal(g.celebrate,'eggs');
});
test('old ready eggs migrate, invalid/milk/unknown slot taps do not collect',()=>{
 const s=ready(),id=s.animals[0].id;assert.deepEqual(eggSlots({...s.animals[0],eggSlots:undefined}),[0,1,2]);
 for(const slot of [-1,3,'0',NaN])assert.equal(farmCollectEgg(s,id,slot,1),s);
 assert.equal(farmCollectEgg(s,'missing',0,1),s);assert.equal(farmCollectEgg({...s,coop:0},id,0,1).bag.egg,0);
 const cow={...s,animals:s.animals.map(a=>({...a,kind:'cow'}))};assert.equal(farmCollectEgg(cow,id,0,1),cow);
});
test('a freed nest slot fills later without duplicating other eggs or resetting their timer',()=>{
 const s=ready(),id=s.animals[0].id,n=farmCollectEgg(s,id,1,1000000);
 assert.deepEqual(eggSlots(n.animals[0]),[0,2]);assert.equal(farmAdvance(n,1000000+FARM_CYCLE_MS-1),n);
 const later=farmAdvance(n,1000000+FARM_CYCLE_MS);assert.deepEqual(eggSlots(later.animals[0]),[0,2,1]);assert.equal(later.bag.egg,1);
});
test('shared walk surface rises continuously up the stairs and meets the deck',()=>{
 const p={x:10,y:20};assert.equal(coopSurfaceHeight(p,10,18.25),0);assert.equal(coopSurfaceHeight(p,10,19.35),.4);
 const mid=coopSurfaceHeight(p,10,18.8);assert.ok(mid>.19&&mid<.21);assert.equal(coopSurfaceHeight(p,10,20),.4);
 assert.equal(coopSurfaceHeight(p,12,20),null);assert.equal(coopSurfaceHeight(p,10,17),null);
});

test('placement protects water, trees, buildings and cultivated soil',async()=>{
 const {coopPlacementStatus,coopSpotNear}=await import('../src/coop-placement.mjs');
 const {cellAt}=await import('../src/core.mjs');
 const world={id:'qa',grid:{origin:[0,0],columns:20,rows:20,mask:Array(400).fill(2)},trees:[],boulders:[],blockers:[]};
 const state={cells:{},buildings:[],removedTrees:[],removedRocks:[],stats:{},inventory:{},clock:{minutes:480,wall:0,paused:true}};
 assert.equal(coopPlacementStatus(world,state,{x:10,y:10}),true);assert.deepEqual(coopSpotNear(world,state,{x:10,y:10}),{x:10,y:10});assert.equal(coopSpotNear(world,state,{x:-1,y:-1}),null);
 assert.equal(coopPlacementStatus(world,state,{x:0,y:0}),false);
 assert.equal(coopPlacementStatus(world,{...state,cells:{[cellAt(world,10,10).key]:{soil:true}}},{x:10,y:10}),false);
 assert.equal(coopPlacementStatus({...world,trees:[{id:'tree',position:[10,10],radius:.5}]},state,{x:10,y:10}),false);
 assert.equal(coopPlacementStatus(world,{...state,buildings:[{id:'fire',kind:'campfire',key:'10:10',rotation:0,status:'complete'}]},{x:10,y:10}),false);
});
test('completed utility buildings offer an Open/Move choice and keep their existing use action',async()=>{
 const {Construction}=await import('../src/construction.js');
 let shown=null;const b={id:'fire',kind:'campfire',key:'10:10',rotation:0,status:'complete'};
 const c={nodes:new Map([['fire',{root:{}}]]),g:{world:{grid:{origin:[0,0]}},store:{state:{buildings:[b]}},showPrompt(...args){shown=args;},notify(){}}};
 const ray={intersectObjects:()=>[{object:{userData:{buildingId:'fire'}}}]};
 assert.equal(Construction.prototype.inspectRay.call(c,ray),true);assert.deepEqual(shown[4].map(a=>a.id),['building-open','move']);
 Construction.prototype.openBuilding.call(c,'fire');assert.equal(c.openMenu.id,'campfire');assert.equal(c.openMenu.fireId,'fire');
});

test('returning hens take the stairs without rewriting their durable home location',async()=>{
 const {LivingFarm}=await import('../src/living-farm.js');
 const animal={id:'living-farm-1',kind:'chicken',ready:1,nextAt:Date.now()+10000};
 const inst={id:animal.id,home:{x:1,y:2}},home=inst.home;let moved=false;
 const farm={state:{coop:1,animals:[animal]},position:{x:10,y:20},g:{animals:{routeTo:()=>[{x:10,y:18}],play(){},stepMove(){moved=true;}}}};
 assert.equal(LivingFarm.prototype.chickenRoutine.call(farm,inst,.02),true);
 assert.equal(inst.home,home);assert.ok(inst.path.some(p=>p.x===10&&p.y===19.35));assert.equal(moved,true);
 animal.ready=0;animal.nextAt=Date.now()+180000;assert.equal(LivingFarm.prototype.chickenRoutine.call(farm,inst,.02),false);assert.equal(inst.coopRoost,false);
});
