import test from 'node:test';
import assert from 'node:assert/strict';
import {GARDEN_PRESETS,FENCE_PRESETS,placeGardenPreset} from '../src/garden-presets.mjs';
import {isOutlineDone} from '../src/garden-plan.mjs';
import {GardenPlan} from '../src/garden-plan.js';
test('every fenced template reserves an entrance and charges only fence posts',()=>{
 for(const p of [...GARDEN_PRESETS,...FENCE_PRESETS].filter(p=>p.fenced)){
 const plan=placeGardenPreset(p.id,'10:10',{col:10,row:5});
 assert.ok(plan.ring.includes(plan.gate));assert.equal(plan.wood,(plan.ring.length-1)*2);
 assert.equal(new Set(plan.ring).size,plan.ring.length);
 assert.ok(plan.keys.every(k=>!plan.ring.includes(k)));
 }
});
test('empty pens finish when fenced without needing crops or closing entrance',()=>{
 for(const p of FENCE_PRESETS){const plan=placeGardenPreset(p.id,'5:6');const posts=plan.ring.filter(k=>k!==plan.gate);
 assert.equal(isOutlineDone(plan,[],posts.slice(1)),false);
 assert.equal(isOutlineDone(plan,[],posts),true);
 }
});
test('garden templates still require planted crops',()=>{
 const plan=placeGardenPreset('square-fenced','2:2');const posts=plan.ring.filter(k=>k!==plan.gate);
 assert.equal(isOutlineDone(plan,[],posts),false);assert.equal(isOutlineDone(plan,plan.keys,posts),true);
});
test('fence-only crew never plows or plants the pen interior',()=>{
 const plan={...placeGardenPreset('pen-small','5:5'),foreman:{crew:['adam']}};
 const gp=new GardenPlan({store:{state:{village:{garden:{playerOutline:plan}}}}});
 assert.deepEqual(gp.plowChores({},gp.state(),new Set()),[]);
 assert.deepEqual(gp.plantChores({},gp.state(),new Set()),[]);
});
test('pen placement saves its crew and fence work without spending on a rejected site',()=>{
 const plan=placeGardenPreset('pen-small','5:5');let state={inventory:{oak_wood:40},buildings:[],cells:{},village:{}};let saved=0;
 const gp=new GardenPlan({store:{get state(){return state},save(s){state=s;saved++}},toast(){}});
 gp.grass=()=>true;gp.occupied=()=>new Set();
 assert.equal(gp.commitPreset(plan,[]),null);assert.equal(saved,0);
 assert.ok(gp.commitPreset(plan,['adam']));assert.equal(saved,1);
 assert.equal(state.village.garden.playerOutline.fenceOnly,true);
 assert.deepEqual(gp.workerIds(),['adam']);
 assert.equal(state.inventory.oak_wood,40);
 gp.occupied=()=>new Set([plan.ring[0]]);
 assert.equal(gp.commitPreset(plan,['adam']),null);assert.equal(saved,1);
});
