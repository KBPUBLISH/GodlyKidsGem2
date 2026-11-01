import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreGoals,chooseGoal,advanceGoal,availableGoals,goalFacts} from '../src/adventure-goals.mjs';
const fresh=()=>restoreGoals(null);
test('new goals count work after selection and advance through real task counters',()=>{
 let s=chooseGoal(fresh(),'garden',{plowed:10,planted:10,watered:10,harvested:10});
 s=advanceGoal(s,{plowed:15,planted:12,watered:10,harvested:10});
 assert.deepEqual(s.records.garden.progress,[5,2,0,0]);
 s=advanceGoal(s,{plowed:15,planted:15,watered:15,harvested:15});
 assert.equal(s.active,null);assert.equal(s.celebrate,'garden');assert.equal(s.records.garden.completed,true);
 assert.deepEqual(advanceGoal(s,{plowed:99}),s);
 assert.equal(availableGoals(s,{}).some(g=>g.id==='garden'),false);
});
test('snack must happen after wood task; earlier meals do not finish it',()=>{
 let s=chooseGoal(fresh(),'wood',{trees:4,mealsEaten:5});
 s=advanceGoal(s,{trees:7,mealsEaten:8});assert.deepEqual(s.records.wood.progress,[3,0]);
 s=advanceGoal(s,{trees:7,mealsEaten:8});assert.equal(s.active,'wood');
 s=advanceGoal(s,{trees:7,mealsEaten:9});assert.equal(s.celebrate,'wood');
});
test('switching goals and restoring a save preserves earlier progress',()=>{
 let s=advanceGoal(chooseGoal(fresh(),'wood',{}),{trees:2});
 s=chooseGoal(s,'fish',{trees:2});s=restoreGoals(JSON.parse(JSON.stringify(s)));
 s=chooseGoal(s,'wood',{trees:2});assert.deepEqual(s.records.wood.progress,[2,0]);
 assert.equal(advanceGoal(s,{trees:1}).records.wood.progress[0],2);
});
test('unknown and locked goals cannot be selected; completion unlocks building choices',()=>{
 assert.equal(chooseGoal(fresh(),'church',{}).active,null);assert.equal(chooseGoal(fresh(),'bad',{}).active,null);
 let s=advanceGoal(chooseGoal(fresh(),'fish',{}),{fishCaught:1});
 assert.equal(availableGoals(s,{}).some(g=>g.id==='hut'),true);
 assert.equal(availableGoals(s,{}).some(g=>g.id==='cottage'),false);
});
test('completed buildings and real stock count; incomplete and cancelled buildings do not',()=>{
 const facts=goalFacts({inventory:{pine_wood:6,oak_wood:4,stone:5},buildings:[{kind:'hut',status:'building'},{kind:'church',status:'cancelled'},{kind:'cottage',status:'complete'}]});
 assert.equal(facts.wood,10);assert.equal(facts['building:hut'],0);assert.equal(facts['building:cottage'],1);
 let s=advanceGoal(chooseGoal(fresh(),'fish',{}),{fishCaught:1});s=chooseGoal(s,'hut',facts);s=advanceGoal(s,facts);
 assert.deepEqual(s.records.hut.progress,[10,5,0]);s=advanceGoal(s,{...facts,wood:0,stone:0,'building:hut':1});assert.equal(s.celebrate,'hut');
});
test('invalid saves and incomplete forged completion receipts do not unlock everything',()=>{
 assert.deepEqual(restoreGoals({version:99}),fresh());
 const s=restoreGoals({version:1,active:'wood',records:{wood:{progress:[0,0],completed:true}}});assert.equal(s.records.wood.completed,false);
});
test('an existing completed creation needs no duplicate supplies or construction',()=>{
 let s=advanceGoal(chooseGoal(fresh(),'fish',{}),{fishCaught:1});
 s=advanceGoal(chooseGoal(s,'hut',{'building:hut':1}),{'building:hut':1});
 assert.equal(s.celebrate,'hut');assert.deepEqual(s.records.hut.progress,[10,5,1]);
});
