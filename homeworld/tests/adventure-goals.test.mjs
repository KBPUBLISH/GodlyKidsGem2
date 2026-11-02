import {focusFor,displayGoal} from '../src/today-goals.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreGoals,chooseGoal,advanceGoal,availableGoals,goalFacts,communityGoalFocus,selectBuildingGoal,FIRST_GOALS,GOALS} from '../src/adventure-goals.mjs';
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
 let s=advanceGoal(chooseGoal(fresh(),'fish',{}),{fishEnjoyed:1});
 assert.equal(availableGoals(s,{}).some(g=>g.id==='hut'),true);
 assert.equal(availableGoals(s,{}).some(g=>g.id==='cottage'),true);
});
test('completed buildings and real stock count; incomplete and cancelled buildings do not',()=>{
 const facts=goalFacts({inventory:{pine_wood:6,oak_wood:4,stone:5},buildings:[{kind:'hut',status:'building'},{kind:'church',status:'cancelled'},{kind:'cottage',status:'complete'}]});
 assert.equal(facts.wood,10);assert.equal(facts['building:hut'],0);assert.equal(facts['building:cottage'],1);
 let s=advanceGoal(chooseGoal(fresh(),'fish',{}),{fishEnjoyed:1});s=chooseGoal(s,'hut',facts);s=advanceGoal(s,facts);
 assert.deepEqual(s.records.hut.progress,[10,5,0]);s=advanceGoal(s,{...facts,wood:0,stone:0,'building:hut':1});assert.equal(s.celebrate,'hut');
});
test('invalid saves and incomplete forged completion receipts do not unlock everything',()=>{
 assert.deepEqual(restoreGoals({version:99}),fresh());
 const s=restoreGoals({version:1,active:'wood',records:{wood:{progress:[0,0],completed:true}}});assert.equal(s.records.wood.completed,false);
});
test('an existing completed creation needs no duplicate supplies or construction',()=>{
 let s=advanceGoal(chooseGoal(fresh(),'fish',{}),{fishEnjoyed:1});
 s=advanceGoal(chooseGoal(s,'hut',{'building:hut':1}),{'building:hut':1});
 assert.equal(s.celebrate,'hut');assert.deepEqual(s.records.hut.progress,[10,5,1]);
});

test('first five goals introduce the coop, garden, cottage, oven and fishing without locks',()=>{
 assert.deepEqual(availableGoals(fresh(),{}).slice(0,5).map(g=>g.id),FIRST_GOALS);
 assert.ok(GOALS.length>=25);
});
test('building goals share only missing work and wait for all real materials',()=>{
 const state={inventory:{stone:0},buildings:[],adventureGoals:chooseGoal(fresh(),'oven',{})};
 assert.deepEqual(communityGoalFocus(state).chores,['mine']);
 state.inventory={stone:20,clay:5};assert.deepEqual(communityGoalFocus(state).chores,[]);
 state.inventory.clay=6;assert.deepEqual(communityGoalFocus(state).chores,['build']);
 assert.equal(advanceGoal(state.adventureGoals,goalFacts(state)).active,'oven');
 state.buildings=[{kind:'oven',status:'complete'}];assert.equal(advanceGoal(state.adventureGoals,goalFacts(state)).celebrate,'oven');
});
test('choosing an unaffordable building saves the goal without choosing a site',()=>{
 let cancelled=false;const game={store:{state:{inventory:{},buildings:[]},save(s){this.state=s;}},building:{cancelPreview(){cancelled=true;}},notify(){}};
 assert.equal(selectBuildingGoal(game,'oven'),true);assert.equal(game.store.state.adventureGoals.active,'oven');assert.deepEqual(game.store.state.buildings,[]);assert.equal(cancelled,true);
});
test('larger goals plan storage first and harvest milestones unlock in order',()=>{
 const s=chooseGoal(fresh(),'cottage',{});assert.equal(advanceGoal(s,goalFacts({inventory:{},buildings:[]})).records.cottage.progress[0],20);
 const garden=advanceGoal(chooseGoal(fresh(),'garden',{}),{plowed:5,planted:5,watered:5,harvested:5});
 assert.ok(availableGoals(garden,{}).some(g=>g.id==='harvest-12'));assert.ok(!availableGoals(garden,{}).some(g=>g.id==='harvest-24'));
});

test('every friend follows the player goal even with a conflicting personal assignment',()=>{
 const state={inventory:{},buildings:[],adventureGoals:chooseGoal(fresh(),'oven',{}),village:{todayGoals:{day:1,overrides:{eve:'off'},extra:null}}};
 for(const name of ['Adam','Eve','Noah','Abel']){
  assert.equal(focusFor(state,name.toLowerCase(),name,1).title,GOALS.find(g=>g.id==='oven').title);
  assert.deepEqual(focusFor(state,name.toLowerCase(),name,1).chores,['mine']);
  assert.equal(displayGoal(state,name.toLowerCase(),name,1).id,'player-goal');
 }
});
test('old cottage progress survives the added storage prerequisite',()=>{
 const saved=restoreGoals({version:1,active:'cottage',records:{cottage:{base:{},progress:[20,10,0],completed:false}}});
 assert.equal(saved.active,'cottage');assert.deepEqual(saved.records.cottage.progress,[0,20,10,0]);
 const done=restoreGoals({version:1,records:{cottage:{base:{},progress:[30,17,1],completed:true}}});assert.equal(done.records.cottage.completed,true);
});
