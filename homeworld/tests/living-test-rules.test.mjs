import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,restoreState,collect,deliver,currentRequest,REQUESTS} from '../src/living-test-rules.mjs';

test('a new child has a personal camp task, not a request from a Bible character',()=>{
  const state=freshState();assert.equal(currentRequest(state).friend,'you');
  assert.equal(state.adamUnlocked,false);
  assert.equal(collect(state,'log-1','adam'),state);
  assert.equal(collect(state,'log-4'),state);
  assert.equal(collect(state,'carrot-1'),state);
});
test('the solo task supports partial deliveries and then pauses for the story invitation',()=>{
  let s=freshState();s=deliver(collect(s,'log-1'),'you');
  assert.equal(s.deposits['first-camp'],1);assert.equal(s.inventory.wood,0);
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);
  for(const id of ['log-2','log-3'])s=deliver(collect(s,id),'you');
  assert.equal(s.stage,1);assert.equal(currentRequest(s),null);
  assert.equal(collect(s,'carrot-1'),s);
});
test('Adam requests and home building unlock only after a verified story receipt is applied',()=>{
  let s=freshState();
  for(const id of ['log-1','log-2','log-3'])s=deliver(collect(s,id),'you');
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
