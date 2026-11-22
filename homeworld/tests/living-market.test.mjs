import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketTrade} from '../src/living-market-rules.mjs';
import {farmFresh} from '../src/living-farm-rules.mjs';
import {GameStore,initialState} from '../src/core.mjs';
import {defaultCrew,crewStatus} from '../src/project-rules.mjs';
const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
test('market buys and sells from one wallet without mutating the original inventory',()=>{
 const farm={...farmFresh(),coins:10},inventory={carrot_seed:1,carrot:2,pine_wood:3};
 const bought=marketTrade(farm,inventory,'buy','carrot_seed');assert.equal(bought.farm.coins,8);assert.equal(bought.inventory.carrot_seed,4);
 const sold=marketTrade(bought.farm,bought.inventory,'sell','carrot');assert.equal(sold.farm.coins,11);assert.equal(sold.inventory.carrot,1);
 assert.equal(marketTrade(sold.farm,sold.inventory,'sell','pine_wood').farm.coins,12);
 assert.equal(farm.coins,10);assert.equal(inventory.carrot_seed,1);
 assert.equal(marketTrade({...farm,coins:1},inventory,'buy','carrot_seed'),null);
 assert.equal(marketTrade(farm,inventory,'sell','diamond'),null);
 assert.equal(marketTrade(farm,inventory,'sell','wood'),null); // tutorial logs remain reserved
 assert.equal(marketTrade(farm,inventory,'buy','unknown'),null);
});
test('failed market saves change neither coins nor seeds; success survives a reload',()=>{
 const data=new Map();let fail=false;const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('Disk full');data.set(k,v);},removeItem:k=>data.delete(k)};
 const store=new GameStore(world,storage);store.save({...store.state,livingFarm:{...farmFresh(),coins:10}});
 const before=store.state,next=marketTrade(before.livingFarm,before.inventory,'buy','pumpkin_seed');
 fail=true;assert.throws(()=>store.save({...before,livingFarm:next.farm,inventory:next.inventory}));assert.deepEqual(store.state,before);
 fail=false;store.save({...store.state,livingFarm:next.farm,inventory:next.inventory});
 const restored=new GameStore(world,storage);assert.equal(restored.state.livingFarm.coins,7);assert.equal(restored.state.inventory.pumpkin_seed,(before.inventory.pumpkin_seed||0)+3);
});
test('only welcomed friends can be assigned to original construction projects',()=>{
 const state=initialState(world);state.livingBuilders=[];
 assert.deepEqual(defaultCrew(state,'hut'),[]);assert.equal(crewStatus(state,'hut',['eve']).ok,false);
 state.livingBuilders=['adam'];assert.deepEqual(defaultCrew(state,'hut'),['adam']);assert.equal(crewStatus(state,'hut',['adam']).ok,true);
 assert.equal(crewStatus(state,'hut',['noah']).ok,false);
});
