import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {farmFresh,farmRestore,farmBuy,farmPurchaseError} from '../src/living-farm-rules.mjs';
import {gardenRestore,gardenApprove,gardenWork,gardenHarvest,prepareLivingGardenBase,GARDEN_GROW_MS} from '../src/living-garden-rules.mjs';
import {initialState,seedStarterGarden} from '../src/core.mjs';
const grow=s=>{s=gardenApprove(s);for(const kind of ['dig','plant'])for(let i=3;i<6;i++)s=gardenWork(s,kind,i,100);return s;};
test('a free garden opens with zero coins; three digs and seeds fund a named chicken exactly once',()=>{
 let s=farmFresh();assert.equal(s.coins,0);assert.equal(farmBuy(s,'chicken','Sunny',0),s);
 assert.equal(gardenWork(s,'dig',3,0),s);s=gardenApprove(s);
 assert.equal(gardenWork(s,'plant',3,0),s);assert.equal(gardenWork(s,'dig',2,0),s);
 s=gardenWork(s,'dig',3,100);assert.equal(gardenWork(s,'dig',3,100),s);
 s=farmRestore(JSON.parse(JSON.stringify(s)));assert.equal(s.garden.dug,1);
 s=grow(s);assert.equal(s.coins,10);assert.equal(s.garden.completed,true);
 assert.equal(gardenWork(s,'plant',5,200),s);assert.equal(grow(farmRestore(s)).coins,10);
 const bought=farmBuy(s,'chicken','Sunny',200);assert.equal(bought.coins,0);assert.equal(bought.animals.length,1);
 assert.equal(farmBuy(bought,'chicken','Again',200),bought);
});
test('harvesting and regrowing gives an affordable repeat loop, without duplicate or early rewards',()=>{
 let s=grow(farmFresh());s={...s,coins:0};s=gardenHarvest(s,0,200);assert.equal(s.coins,2);
 assert.equal(gardenHarvest(s,0,200),s);assert.equal(gardenHarvest(s,3,200),s);
 s=farmRestore(s);assert.equal(gardenHarvest(s,0,199),s);
 s=gardenHarvest(s,0,200+GARDEN_GROW_MS);assert.equal(s.coins,4);
 assert.equal(gardenHarvest(s,-1,100000),s);assert.equal(gardenHarvest(s,6,100000),s);
});
test('saved insufficient balances and invalid names get accurate purchase errors',()=>{
 const s={...grow(farmFresh()),coins:3};assert.equal(farmRestore(s).coins,3);
 assert.match(farmPurchaseError(s,'chicken','Sunny',1),/You have 3 coins.*7 more/);
 assert.match(farmPurchaseError({...s,coins:10},'chicken','<>',1),/name/);
 assert.equal(farmBuy(s,'chicken','Sunny',1),s);
});
test('the small starter garden replaces only untouched demo crops and keeps earned progress',()=>{
 const w=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
 const original=seedStarterGarden(initialState(w,0),w);assert.equal(Object.keys(original.cells).length,16);
 const small=prepareLivingGardenBase(original,w);assert.equal(small.livingGardenLayout,'small');assert.equal(Object.keys(small.cells).length,0);
 assert.equal(prepareLivingGardenBase(small,w),small);assert.equal(Object.keys(original.cells).length,16);
 const played={...original,stats:{...original.stats,harvested:1},inventory:{carrot:3}};
 const kept=prepareLivingGardenBase(played,w);assert.equal(kept.livingGardenLayout,'existing');assert.deepEqual(kept.cells,played.cells);assert.deepEqual(kept.inventory,played.inventory);
});

test('each highlighted square can be worked in any order and legacy counts migrate',()=>{
 let s=gardenApprove(farmFresh());for(const i of [5,3,4])s=gardenWork(s,'dig',i,100);
 for(const i of [4,5,3])s=gardenWork(farmRestore(s),'plant',i,200);
 assert.equal(s.coins,10);assert.deepEqual(s.garden.dugSpots,[5,3,4]);assert.deepEqual(s.garden.plantedSpots,[4,5,3]);
 const old={...s.garden,dug:2,planted:0};delete old.dugSpots;delete old.plantedSpots;
 assert.deepEqual(gardenRestore(old).dugSpots,[3,4]);assert.deepEqual(gardenRestore(old).plantedSpots,[]);
});
