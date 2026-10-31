import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {farmFresh,farmRestore,farmBuy,farmPurchaseError} from '../src/living-farm-rules.mjs';
import {gardenRestore,gardenWork,gardenHarvest,prepareLivingGardenBase,starterTasks,gardenAvailable,GARDEN_GROW_MS,CARROT_SPOTS,gardenCrop,gardenNext} from '../src/living-garden-rules.mjs';
import {initialState,seedStarterGarden} from '../src/core.mjs';
const grow=s=>{for(const i of CARROT_SPOTS)s=gardenWork(s,'plant',i,100);return s;};
test('four free carrot seeds work in any order and pay the planting reward exactly once',()=>{
 let s=farmFresh();assert.equal(s.coins,0);assert.equal(farmBuy(s,'chicken','Sunny',0),s);
 assert.deepEqual(gardenAvailable(s.garden),CARROT_SPOTS);
 assert.equal(gardenWork(s,'plant',1,0),s);assert.equal(gardenHarvest(s,1,100),s);
 s=gardenWork(s,'plant',5,100);assert.equal(gardenWork(s,'plant',5,100),s);
 s=farmRestore(JSON.parse(JSON.stringify(s)));assert.equal(s.garden.planted,1);
 for(const i of [3,0,4])s=gardenWork(s,'plant',i,100);
 assert.deepEqual(s.garden.plantedSpots,[5,3,0,4]);assert.equal(s.coins,10);assert.equal(s.garden.completed,false);
 assert.equal(gardenWork(s,'plant',5,200),s);assert.equal(grow(farmRestore(s)).coins,10);
 const bought=farmBuy(s,'chicken','Sunny',200);assert.equal(bought.coins,0);assert.equal(bought.animals.length,1);
 assert.equal(farmBuy(bought,'chicken','Again',200),bought);
});
test('harvesting and regrowing gives an affordable repeat loop, without duplicate or early rewards',()=>{
 let s=grow(farmFresh());s={...s,coins:0};assert.equal(gardenHarvest(s,0,200),s);
 s=gardenWork(s,'water',0,100);s=gardenWork(s,'water',3,100);
 const ripe=100+GARDEN_GROW_MS.carrot;
 s=gardenHarvest(s,0,ripe);assert.equal(s.coins,2);assert.equal(gardenHarvest(s,0,ripe),s);
 s=gardenHarvest(s,3,ripe);assert.deepEqual(s.garden.picked,{carrot:1,pumpkin:0,lettuce:0});assert.equal(s.garden.completed,false);
 s=farmRestore(s);assert.equal(gardenHarvest(s,0,ripe-1),s);
 s=gardenHarvest(s,1,ripe);assert.equal(s.garden.completed,false);
 s=gardenHarvest(s,2,ripe);assert.equal(s.garden.completed,true);assert.equal(s.coins,8);
 assert.equal(gardenHarvest(s,0,ripe+86400000),s);
 s=gardenWork(s,'water',0,ripe);s=gardenHarvest(s,0,ripe+GARDEN_GROW_MS.carrot);assert.equal(s.coins,10);
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

test('tasks unlock in order, count each vegetable separately, and survive reload',()=>{
 let s=farmFresh();assert.deepEqual(starterTasks(s.garden,false).map(t=>t.locked),[false,true,true]);
 s=grow(s);assert.deepEqual(starterTasks(s.garden,false).map(t=>t.locked),[false,false,true]);s=gardenWork(s,'water',0,100);
 for(const i of [0,1])s=gardenHarvest(s,i,100+GARDEN_GROW_MS.carrot);
 s=farmRestore(JSON.parse(JSON.stringify(s)));assert.equal(starterTasks(s.garden,false)[1].value,2);
 assert.equal(starterTasks(s.garden,false)[2].locked,true);
 s=gardenHarvest(s,2,100+GARDEN_GROW_MS.carrot);assert.equal(s.coins,16);
 assert.deepEqual(starterTasks(s.garden,false).map(t=>t.done),[true,true,false]);
 assert.equal(starterTasks(s.garden,false)[2].locked,false);
 assert.ok(starterTasks(s.garden,true).every(t=>t.done));
});
test('legacy partial work and paid planting rewards migrate without lost coins or duplicate rewards',()=>{
 const old={approved:true,dug:3,planted:2,readyAt:[0,0,0,0,0,0]};
 let s=farmRestore({...farmFresh(),coins:3,garden:old});assert.deepEqual(s.garden.plantedSpots,[3,4]);
 assert.equal(grow(s).coins,13);
 s=farmRestore({...s,coins:27,garden:{...old,planted:3,completed:true}});
 assert.equal(s.garden.planted,4);assert.equal(s.garden.rewarded,true);assert.equal(s.garden.completed,false);
 assert.equal(grow(s).coins,27);assert.equal(farmRestore(s).coins,27);
 assert.equal(gardenRestore({...s.garden,plantedSpots:[0,0,4,5]}).planted,0);
});


test('each vegetable needs water and grows for its full distinct duration, including regrowth',()=>{
 assert.ok(GARDEN_GROW_MS.lettuce<GARDEN_GROW_MS.carrot&&GARDEN_GROW_MS.carrot<GARDEN_GROW_MS.pumpkin);
 let s=grow(farmFresh());
 for(const [index,crop] of [[0,'carrot'],[1,'pumpkin'],[2,'lettuce']]){
  if(index)s=gardenHarvest(s,index,200); // The two pre-grown arrival crops can be picked once.
  assert.equal(gardenCrop(s.garden,index,99999999).phase,'thirsty');
  assert.equal(gardenHarvest(s,index,99999999),s);
  const coins=s.coins;s=gardenWork(s,'water',index,1000);
  assert.equal(s.coins,coins);assert.equal(gardenWork(s,'water',index,1001),s);
  assert.equal(s.garden.readyAt[index],1000+GARDEN_GROW_MS[crop]);
  assert.equal(gardenCrop(s.garden,index,1000).progress,0);
  const end=s.garden.readyAt[index];s=farmRestore(JSON.parse(JSON.stringify(s)));
  assert.equal(gardenHarvest(s,index,end-1),s);
  assert.equal(gardenCrop(s.garden,index,1000+GARDEN_GROW_MS[crop]/2).progress,.5);
  s=gardenHarvest(s,index,end);assert.equal(s.coins,coins+2);
  assert.equal(gardenCrop(s.garden,index,end).phase,'thirsty');
  assert.equal(gardenHarvest(s,index,end+86400000),s);
 }
});
test('dry seedlings survive offline time, watering persists, and elapsed time never auto-harvests',()=>{
 let s=grow(farmFresh());assert.equal(gardenNext(s.garden,100).kind,'water');
 s=farmRestore(JSON.parse(JSON.stringify(s)));
 assert.equal(gardenCrop(s.garden,0,86400000).progress,0);
 for(const i of CARROT_SPOTS)s=gardenWork(s,'water',i,100);
 assert.equal(gardenNext(s.garden,100).kind,'harvest'); // Arrival pumpkin/lettuce, while carrots grow.
 s=gardenHarvest(s,1,100);s=gardenHarvest(s,2,100);
 assert.equal(gardenNext(s.garden,101).kind,'wait');
 s=farmRestore(JSON.parse(JSON.stringify(s)));
 assert.equal(s.garden.readyAt[0],100+GARDEN_GROW_MS.carrot);
 assert.equal(gardenCrop(s.garden,0,86400000).phase,'ready');assert.equal(s.coins,14);
 assert.equal(gardenWork(s,'water',-1,0),s);assert.equal(gardenWork(s,'water',6,0),s);
 assert.equal(gardenWork(s,'water',0,NaN),s);
});
test('version 2 migration keeps ripe crops and earned tasks but stops old automatic regrowth',()=>{
 const now=100000,old={...grow(farmFresh()).garden,version:2,picked:{carrot:1,pumpkin:1,lettuce:1},completed:true,readyAt:[now-1,now+30000,0,now+8000,0,0]};delete old.wateredAt;
 const migrated=gardenRestore(old,now);
 assert.equal(migrated.version,3);assert.equal(migrated.completed,true);assert.equal(migrated.rewarded,true);
 assert.equal(gardenCrop(migrated,0,now).phase,'ready');assert.equal(gardenCrop(migrated,2,now).phase,'ready');
 assert.equal(gardenCrop(migrated,1,now+86400000).phase,'thirsty');assert.equal(gardenCrop(migrated,3,now+86400000).phase,'thirsty');
 assert.deepEqual(gardenRestore(migrated,now+86400000),migrated);
});
