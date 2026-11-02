import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {farmFresh,farmRestore,farmBuy,farmPurchaseError} from '../src/living-farm-rules.mjs';
import {gardenRestore,gardenWork,gardenHarvest,prepareLivingGardenBase,starterTasks,gardenAvailable,GARDEN_GROW_MS,CARROT_SPOTS,gardenCrop,gardenNext,GARDEN_CROPS} from '../src/living-garden-rules.mjs';
import {initialState,seedStarterGarden} from '../src/core.mjs';
const grow=s=>{if(s.garden.starterCarrot)s=gardenHarvest(s,0,100);for(const i of CARROT_SPOTS)s=gardenWork(s,'plant',i,100);return s;};
test('four free carrot seeds work in any order and pay the planting reward exactly once',()=>{
 let s=farmFresh();assert.equal(s.coins,0);assert.equal(farmBuy(s,'chicken','Sunny',0),s);
 assert.deepEqual(gardenAvailable(s.garden),[...CARROT_SPOTS,1,2]);
 assert.equal(gardenWork(s,'plant',1,0),s);s=gardenHarvest(s,0,100);
 s=gardenWork(s,'plant',5,100);assert.equal(gardenWork(s,'plant',5,100),s);
 s=farmRestore(JSON.parse(JSON.stringify(s)));assert.equal(s.garden.planted,1);
 for(const i of [3,0,4])s=gardenWork(s,'plant',i,100);
 assert.deepEqual(s.garden.plantedSpots,[5,3,0,4]);assert.equal(s.coins,10);assert.equal(s.garden.completed,false);
 assert.equal(gardenWork(s,'plant',5,200),s);assert.equal(grow(farmRestore(s)).coins,10);
 assert.equal(farmBuy(s,'chicken','Sunny',200),s);
 const bought=farmBuy({...s,coop:1},'chicken','Sunny',200);assert.equal(bought.coins,0);assert.equal(bought.animals.length,1);
 assert.equal(farmBuy(bought,'chicken','Again',200),bought);
});
test('harvesting and regrowing gives an affordable repeat loop, without duplicate or early rewards',()=>{
 let s=grow(farmFresh());s={...s,coins:0};assert.equal(gardenHarvest(s,0,200),s);
 for(const i of CARROT_SPOTS)s=gardenWork(s,'water',i,100);
 const ripe=100+GARDEN_GROW_MS.carrot;
 s=gardenHarvest(s,0,ripe);assert.equal(s.coins,0);assert.equal(gardenHarvest(s,0,ripe),s);
 s=gardenHarvest(s,3,ripe);assert.deepEqual(s.garden.picked,{carrot:1,pumpkin:0,lettuce:0});assert.equal(s.garden.completed,false);
 s=farmRestore(s);assert.equal(gardenHarvest(s,0,ripe-1),s);
 s=gardenHarvest(s,1,ripe);assert.equal(s.garden.completed,false);
 s=gardenHarvest(s,2,ripe);assert.equal(s.garden.completed,true);assert.equal(s.coins,0);
 assert.equal(gardenHarvest(s,0,ripe+86400000),s);
 s=gardenWork(s,'plant',0,ripe);s=gardenWork(s,'water',0,ripe);s=gardenHarvest(s,0,ripe+GARDEN_GROW_MS.carrot);assert.equal(s.coins,0);
 assert.equal(gardenHarvest(s,-1,100000),s);assert.equal(gardenHarvest(s,6,100000),s);
});
test('saved insufficient balances get accurate purchase errors',()=>{
 const s={...grow(farmFresh()),coop:1,coins:3};assert.equal(farmRestore(s).coins,3);
 assert.match(farmPurchaseError(s,'chicken','',1),/You have 3 coins.*7 more/);
 assert.equal(farmPurchaseError({...s,coins:10},'chicken','',1),null);
 assert.equal(farmBuy(s,'chicken','',1),s);
});
test('the small starter garden replaces only untouched demo crops and keeps earned progress',()=>{
 const w=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
 const original=seedStarterGarden(initialState(w,0),w);assert.equal(Object.keys(original.cells).length,16);
 const small=prepareLivingGardenBase(original,w);assert.equal(small.livingGardenLayout,'small');assert.equal(Object.keys(small.cells).length,0);
 assert.equal(prepareLivingGardenBase(small,w),small);assert.equal(Object.keys(original.cells).length,16);
 const played={...original,stats:{...original.stats,harvested:1},inventory:{carrot:3}};
 const kept=prepareLivingGardenBase(played,w);assert.equal(kept.livingGardenLayout,'existing');assert.deepEqual(kept.cells,played.cells);assert.deepEqual(kept.inventory,played.inventory);
});

test('tasks unlock in order and finish with Adam placed after the tent',()=>{
 let s=farmFresh();assert.deepEqual(starterTasks(s.garden,false).map(t=>t.locked),[false,true,true,true,true]);
 s=grow(s);assert.deepEqual(starterTasks(s.garden,false).map(t=>t.locked),[false,false,true,true,true]);for(const i of CARROT_SPOTS)s=gardenWork(s,'water',i,100);
 for(const i of [0,1])s=gardenHarvest(s,i,100+GARDEN_GROW_MS.carrot);
 s=farmRestore(JSON.parse(JSON.stringify(s)));assert.equal(starterTasks(s.garden,false)[1].value,2);
 assert.equal(starterTasks(s.garden,false)[2].locked,true);
 s=gardenHarvest(s,2,100+GARDEN_GROW_MS.carrot);assert.equal(s.coins,10);
 assert.deepEqual(starterTasks(s.garden,false).map(t=>t.done),[true,true,false,false,false]);
 assert.equal(starterTasks(s.garden,false)[2].locked,false);
 assert.equal(starterTasks(s.garden,true,'aboard')[4].locked,false);assert.equal(starterTasks(s.garden,true,'aboard')[4].done,false);
 assert.equal(starterTasks(s.garden,true,'placing')[4].done,false);
 assert.ok(starterTasks(s.garden,true,'placed').every(t=>t.done));
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
  if(index){s=gardenHarvest(s,index,200);assert.equal(gardenCrop(s.garden,index,99999999).phase,'empty');assert.equal(gardenWork(s,'water',index,1000),s);s=gardenWork(s,'plant',index,300);} // Arrival crops must be replanted after picking.
  assert.equal(gardenCrop(s.garden,index,99999999).phase,'thirsty');
  assert.equal(gardenHarvest(s,index,99999999),s);
  const coins=s.coins;s=gardenWork(s,'water',index,1000);
  assert.equal(s.coins,coins);assert.equal(gardenWork(s,'water',index,1001),s);
  assert.equal(s.garden.readyAt[index],1000+GARDEN_GROW_MS[crop]);
  assert.equal(gardenCrop(s.garden,index,1000).progress,0);
  const end=s.garden.readyAt[index];s=farmRestore(JSON.parse(JSON.stringify(s)));
  assert.equal(gardenHarvest(s,index,end-1),s);
  assert.equal(gardenCrop(s.garden,index,1000+GARDEN_GROW_MS[crop]/2).progress,.5);
  s=gardenHarvest(s,index,end);assert.equal(s.coins,coins);
  assert.equal(gardenCrop(s.garden,index,end).phase,'empty');
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
 assert.equal(s.garden.completed,true); // The starter carrot removes the forced growing wait.
 s=farmRestore(JSON.parse(JSON.stringify(s)));
 assert.equal(s.garden.readyAt[0],100+GARDEN_GROW_MS.carrot);
 assert.equal(gardenCrop(s.garden,0,86400000).phase,'ready');assert.equal(s.coins,10);
 assert.equal(gardenWork(s,'water',-1,0),s);assert.equal(gardenWork(s,'water',6,0),s);
 assert.equal(gardenWork(s,'water',0,NaN),s);
});
test('version 2 migration keeps ripe crops and earned tasks but stops old automatic regrowth',()=>{
 const now=100000,old={...grow(farmFresh()).garden,version:2,picked:{carrot:1,pumpkin:1,lettuce:1},completed:true,readyAt:[now-1,now+30000,0,now+8000,0,0]};delete old.wateredAt;
 const migrated=gardenRestore(old,now);
 assert.equal(migrated.version,5);assert.equal(migrated.completed,true);assert.equal(migrated.rewarded,true);
 assert.equal(gardenCrop(migrated,0,now).phase,'ready');assert.equal(gardenCrop(migrated,2,now).phase,'ready');
 assert.equal(gardenCrop(migrated,1,now+86400000).phase,'thirsty');assert.equal(gardenCrop(migrated,3,now+86400000).phase,'thirsty');
 assert.deepEqual(gardenRestore(migrated,now+86400000),migrated);
});

test('arrival vegetables are immediately harvestable once and survive saves before planting',()=>{
 let s=farmFresh();
 for(const i of [0,1,2]){
  assert.equal(gardenCrop(s.garden,i,100).phase,'ready');
  const before=s;s=gardenHarvest(s,i,100);assert.notEqual(s,before);
  assert.equal(gardenHarvest(s,i,100),s);
  s=farmRestore(JSON.parse(JSON.stringify(s)));
 }
 assert.deepEqual(s.garden.picked,{carrot:1,pumpkin:1,lettuce:1});assert.equal(s.coins,0);
 assert.equal(gardenCrop(s.garden,0,100).phase,'empty');assert.equal(s.garden.starterCarrot,false);
 s=grow(s);assert.equal(s.garden.completed,false);assert.equal(s.coins,10);
 for(const i of CARROT_SPOTS)s=gardenWork(s,'water',i,100);
 assert.equal(s.garden.completed,true);assert.equal(gardenCrop(s.garden,0,100).phase,'growing');
 assert.equal(starterTasks(s.garden,false,'offered',2).find(t=>t.id==='tent').locked,true);
 assert.equal(starterTasks(s.garden,false,'offered',3).find(t=>t.id==='tent').locked,false);
});
test('old planted carrots keep their timers and old untouched gardens gain the ripe starter carrot',()=>{
 const old={...farmFresh().garden,version:3,starterCarrot:undefined,wateredAt:[null,0,0,null,null,null]};
 assert.equal(gardenCrop(gardenRestore(old,100),0,100).phase,'ready');
 const planted={...old,planted:1,plantedSpots:[0],wateredAt:[100,0,0,null,null,null],readyAt:[180100,0,0,0,0,0]};
 const restored=gardenRestore(planted,100);assert.equal(restored.starterCarrot,false);assert.equal(restored.readyAt[0],180100);
});

test('all harvested plots stay empty after reload and need new planting before watering',()=>{
 let s=grow(farmFresh());for(const i of CARROT_SPOTS)s=gardenWork(s,'water',i,100);
 const now=100+GARDEN_GROW_MS.carrot;
 for(let i=0;i<6;i++)s=gardenHarvest(s,i,now);
 const reward=s.coins;
 assert.equal(s.garden.completed,true);
 for(let cycle=0;cycle<2;cycle++){
  s=farmRestore(JSON.parse(JSON.stringify(s)));
  for(let i=0;i<6;i++){
   assert.equal(gardenCrop(s.garden,i,now+86400000).phase,'empty');
   assert.equal(gardenWork(s,'water',i,now),s);
   assert.equal(gardenHarvest(s,i,now+86400000),s);
   const before=s;s=gardenWork(s,'plant',i,now);assert.notEqual(s,before);
   assert.equal(gardenWork(s,'plant',i,now),s);
   assert.equal(gardenCrop(s.garden,i,now).phase,'thirsty');
   s=gardenWork(s,'water',i,now);s=gardenHarvest(s,i,now+GARDEN_GROW_MS[GARDEN_CROPS[i]]);
  }
  assert.equal(s.coins,reward);assert.equal(s.garden.planted,4);assert.equal(s.garden.plantedSpots.length,4);assert.equal(s.garden.completed,true);
 }
});
test('version 4 harvested ground migrates empty without erasing live growth or completed tasks',()=>{
 const old={...grow(farmFresh()).garden,version:4,watered:true,completed:true,picked:{carrot:1,pumpkin:1,lettuce:1},wateredAt:[null,null,null,100,0,0],readyAt:[0,0,0,180100,0,0]};
 const next=gardenRestore(old,200);
 for(const i of [0,1,2])assert.equal(gardenCrop(next,i,99999999).phase,'empty');
 assert.equal(gardenCrop(next,3,200).phase,'growing');assert.equal(gardenCrop(next,4,200).phase,'ready');
 assert.equal(next.completed,true);assert.equal(next.rewarded,true);assert.deepEqual(gardenRestore(next,99999999),next);
});
test('harvesting early while watering the other carrots never loses tutorial watering credit',()=>{
 let s=grow(farmFresh());s=gardenWork(s,'water',0,100);s=gardenHarvest(s,0,180100);
 for(const i of [3,4,5])s=gardenWork(s,'water',i,180101);
 s=gardenHarvest(s,1,180101);s=gardenHarvest(s,2,180101);
 assert.equal(s.garden.watered,true);assert.equal(s.garden.completed,true);assert.equal(gardenCrop(s.garden,0,180101).phase,'empty');
});

test('repeat vegetable planting does not displace the four starter carrot seeds',()=>{
 let s=farmFresh();s=gardenHarvest(s,1,100);s=gardenHarvest(s,2,100);
 assert.equal(gardenNext(s.garden,100).crop,'carrot');
 assert.ok(CARROT_SPOTS.includes(gardenNext(s.garden,100).index));
});

test('a replanted vegetable can be watered before the four starter carrots are finished',()=>{
 let s=farmFresh();s=gardenHarvest(s,1,100);s=gardenWork(s,'plant',1,101);s=gardenWork(s,'water',1,102);
 assert.equal(gardenCrop(s.garden,1,102).phase,'growing');assert.equal(s.garden.planted,0);assert.equal(s.garden.completed,false);
});
