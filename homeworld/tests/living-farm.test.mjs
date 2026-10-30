import test from 'node:test';
import assert from 'node:assert/strict';
import {farmFresh,farmRestore,farmOffer,farmBuy,farmAdvance,farmCollect,farmUse,FARM_CYCLE_MS,FIRST_EGG_MS} from '../src/living-farm-rules.mjs';
const funded=()=>({...farmFresh(),coins:10});
test('buying needs a name, room and enough coins; duplicate confirms cannot overspend',()=>{
 const s=funded();assert.equal(farmBuy(s,'chicken','',0),s);assert.equal(farmBuy(s,'cow','Daisy',0),s);
 const bought=farmBuy(s,'chicken','  Sunny  ',0);assert.equal(bought.coins,0);assert.equal(bought.animals[0].name,'Sunny');assert.equal(farmBuy(bought,'chicken','Again',0),bought);assert.equal(s.animals.length,0);
 assert.deepEqual(farmRestore(JSON.parse(JSON.stringify(bought))),bought);
});
test('first egg comes soon; later production repeats, caps offline and cannot be collected twice',()=>{
 let s=farmBuy(funded(),'chicken','Sunny',0);assert.equal(farmAdvance(s,FIRST_EGG_MS-1),s);
 s=farmAdvance(s,FIRST_EGG_MS);assert.equal(s.animals[0].ready,1);
 s=farmCollect(s,s.animals[0].id,FIRST_EGG_MS);assert.equal(s.bag.egg,1);assert.equal(farmCollect(s,s.animals[0].id,FIRST_EGG_MS),s);
 assert.equal(farmAdvance(s,FIRST_EGG_MS+FARM_CYCLE_MS-1),s);
 s=farmAdvance(s,100*FARM_CYCLE_MS);assert.equal(s.animals[0].ready,3);
 s=farmCollect(s,s.animals[0].id,100*FARM_CYCLE_MS);assert.equal(farmAdvance(s,100*FARM_CYCLE_MS),s);
});
test('eggs can be eaten or sold; earning funds buys larger coops and milk-producing cows',()=>{
 let s=farmBuy(funded(),'chicken','Sunny',0);
 for(let t=1;t<=6;t++){s=farmAdvance(s,t*FARM_CYCLE_MS);s=farmCollect(s,s.animals[0].id,t*FARM_CYCLE_MS);s=farmUse(s,'egg','sell');}
 assert.equal(s.coins,30);s=farmBuy(s,'coop','',0);assert.equal(s.coop,1);assert.equal(farmOffer(s,'cow').reason,null);
 const rich={...s,coins:40};s=farmBuy(rich,'cow','Daisy',0);s=farmAdvance(s,FARM_CYCLE_MS);s=farmCollect(s,s.animals[1].id,FARM_CYCLE_MS);assert.equal(s.bag.milk,1);
 const ate=farmUse(s,'milk','eat');assert.equal(ate.bag.milk,0);assert.equal(ate.coins,s.coins);assert.equal(farmUse(ate,'milk','sell'),ate);
});
test('invalid receipts do not become spendable and clock rollback creates no produce',()=>{
 assert.deepEqual(farmRestore({...farmFresh(),coins:-1}),farmFresh());
 const s=farmBuy(funded(),'chicken','Sunny',100);assert.equal(farmAdvance(s,0),s);
});
