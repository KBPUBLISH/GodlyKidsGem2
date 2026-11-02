import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,restoreState,collect,deliver,currentRequest,REQUESTS,guidance,recordStarterTrees,starterTrees,activeResourceIds} from '../src/living-test-rules.mjs';

test('a new child has a personal camp task, not a request from a Bible character',()=>{
  const state=freshState();assert.equal(currentRequest(state).friend,'you');
  assert.equal(state.adamUnlocked,false);
  assert.equal(collect(state,'log-1','adam'),state);
  assert.equal(collect(state,'log-4'),state);
  assert.equal(collect(state,'carrot-1'),state);
});
test('the solo task supports partial deliveries and then pauses for the story invitation',()=>{
  let s=recordStarterTrees(freshState(),0);s=deliver(recordStarterTrees(s,1),'you');
  assert.equal(s.deposits['first-camp'],1);assert.equal(s.inventory.wood,0);
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);
  for(const n of [2,3])s=deliver(recordStarterTrees(s,n),'you');
  assert.equal(s.stage,1);assert.equal(currentRequest(s),null);
  assert.equal(collect(s,'carrot-1'),s);
});
test('Adam requests and home building unlock only after a verified story receipt is applied',()=>{
  let s=recordStarterTrees(freshState(),0);
  for(const n of [1,2,3])s=deliver(recordStarterTrees(s,n),'you');
  s.adamUnlocked=true;assert.equal(currentRequest(s).friend,'adam');
  for(const id of ['carrot-1','carrot-2','carrot-3','carrot-4'])s=deliver(collect(s,id),'adam');
  assert.equal(s.stage,2);
  for(const id of ['log-4','log-5','log-6'])s=deliver(collect(s,id),'adam');
  assert.equal(s.stage,3);assert.deepEqual(s.inventory,{wood:0,carrot:0});
  assert.equal(restoreState({...s,adamUnlocked:true}).adamUnlocked,false,'Stored request state cannot grant a friend');
});
test('older prototype data and invalid delivery records cannot skip the solo opening',()=>{
  assert.deepEqual(restoreState({version:1,stage:3,adamUnlocked:true}),freshState());
  assert.deepEqual(restoreState({version:2,stage:3,gathered:[]}),freshState());
  const s=restoreState({version:2,stage:0,gathered:['log-1','log-1','__proto__'],inventory:{wood:999},adamUnlocked:true});
  assert.deepEqual(s.gathered,['log-1']);assert.equal(s.inventory.wood,1);assert.equal(s.adamUnlocked,false);
});

test('guidance counts pickups immediately and switches to delivery only when enough are found',()=>{
  let s=recordStarterTrees(freshState(),0);assert.equal(guidance(s).delivery,false);
  s=recordStarterTrees(s,1);assert.equal(guidance(s).found,1);assert.equal(guidance(s).delivery,false);
  s=deliver(s,'you');assert.equal(guidance(s).found,1);
  s=recordStarterTrees(s,3);assert.equal(guidance(s).delivery,true);
  s=deliver(deliver(s,'you'),'you');assert.equal(guidance(s),null);
  s.adamUnlocked=true;assert.equal(guidance(s).noun,'carrots');assert.equal(guidance(s).found,0);
});

 test('three full trees count once, survive reopening, and loose logs cannot bypass the task',()=>{
 let s=recordStarterTrees(freshState(),12);
 assert.deepEqual(activeResourceIds(s),[]);assert.equal(collect(s,'log-1'),s);
 assert.equal(recordStarterTrees(s,12),s);
 s=recordStarterTrees(s,13);assert.equal(starterTrees(s),1);assert.equal(s.inventory.wood,1);
 s=restoreState(JSON.parse(JSON.stringify(s)));assert.equal(recordStarterTrees(s,13),s);
 s=recordStarterTrees(s,15);assert.equal(starterTrees(s),3);assert.equal(s.inventory.wood,3);
 assert.equal(recordStarterTrees(s,20),s);assert.equal(guidance(s).delivery,true);
 const old=restoreState({version:2,stage:1,gathered:['log-1','log-2','log-3']});
 assert.equal(old.stage,1);assert.equal(old.deposits['first-camp'],3);
 });
