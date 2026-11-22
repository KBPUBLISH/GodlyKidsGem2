import test from 'node:test';
import assert from 'node:assert/strict';
import {coachMilestones,coachBeat,LivingCoach} from '../src/living-coach.mjs';
import {gardenFresh} from '../src/living-garden-rules.mjs';
import {freshState} from '../src/living-test-rules.mjs';
test('Perry guides real completed milestones and never invites a friend before a tent',()=>{
 const g=gardenFresh(),s=freshState();assert.deepEqual(coachMilestones(g,s),[]);
 g.planted=4;assert.deepEqual(coachMilestones(g,s),['planted']);
 g.wateredAt.fill(100);assert.deepEqual(coachMilestones(g,s),['planted','watered']);
 g.completed=true;assert.equal(coachBeat('harvested','Mikey',g,s).action,'next');
 s.inventory.wood=3;assert.equal(coachMilestones(g,s).at(-1),'wood');
 assert.ok(!coachMilestones(g,s).includes('tent'));
 s.stage=1;assert.equal(coachMilestones(g,s).at(-1),'tent');
 const beat=coachBeat('tent','Mikey',g,s);assert.match(beat.spoken,/Mikey/);assert.match(beat.spoken,/somewhere for a friend to stay/);assert.equal(beat.action,'friend');
});
test('coach remembers completed beats, collapses simultaneous completions and validates actions',()=>{
 const messages=[];globalThis.window={parent:{postMessage:m=>messages.push(m)},location:{origin:'https://test'}};globalThis.location=window.location;
 const state=freshState(),garden=gardenFresh();let actions=0;
 const test={state,playerName:'Sarah',farm:{state:{garden}},garden:{go:()=>actions++},showNext:()=>actions++,requestFirstFriend:()=>actions++,dismissInvite:()=>{},g:{store:{state:{},save(s){this.state=s;}}}};
 const coach=new LivingCoach(test);coach.update();garden.planted=4;coach.update();assert.equal(coach.beat.id,'planted');
 coach.respond('wrong','next');coach.respond('planted','unknown');assert.equal(actions,0);assert.equal(coach.beat.id,'planted');coach.respond('planted','next');assert.equal(actions,1);coach.update();assert.equal(coach.beat,null);
 const restored=new LivingCoach(test);restored.update();assert.equal(restored.beat,null);
 garden.completed=true;state.inventory.wood=3;restored.update();assert.equal(restored.beat.id,'wood');
 assert.ok(test.g.store.state.livingCoachSeen.includes('harvested'));
 state.stage=1;restored.update();assert.equal(restored.beat.id,'tent');restored.respond('tent','next');assert.equal(actions,2);
 delete globalThis.window;delete globalThis.location;
});

test('tent guidance respects Adam aboard, being placed, and already home',()=>{
 const garden=gardenFresh(),state={...freshState(),stage:1};
 for(const phase of ['aboard','placing']){
  const beat=coachBeat('tent','Mikey',garden,state,phase);
  assert.equal(beat.action,'friend');assert.doesNotMatch(beat.spoken,/find your first|go to the Godly Ship/i);
  assert.equal(beat.label,phase==='aboard'?'Bring Adam':'Choose a spot');
 }
 for(const phase of ['placed','unlocked'])assert.equal(coachBeat('tent','Mikey',garden,state,phase),null);
 assert.equal(coachBeat('tent','Mikey',garden,{...state,adamUnlocked:true}),null);
 assert.equal(coachBeat('tent','Mikey',garden,state,'reward').label,'Find a friend');
});
test('an open tent card updates as Adam moves aboard and disappears after placement',()=>{
 const messages=[];globalThis.window={parent:{postMessage:m=>messages.push(m)},location:{origin:'https://test'}};globalThis.location=window.location;
 try{
  let requests=0;
  const t={state:{...freshState(),stage:1},friendPhase:'offered',playerName:'Mikey',farm:{state:{garden:gardenFresh()}},requestFirstFriend:()=>requests++,g:{store:{state:{livingCoachSeen:[]},save(s){this.state=s;}}}};
  const coach=new LivingCoach(t);coach.update();assert.equal(coach.beat.label,'Find a friend');
  t.friendPhase='aboard';coach.update();assert.equal(messages.at(-1).beat.label,'Bring Adam');
  t.friendPhase='placing';coach.update();assert.equal(messages.at(-1).beat.label,'Choose a spot');
  t.friendPhase='placed';coach.update();assert.equal(coach.beat,null);assert.equal(messages.at(-1).beat,null);
  coach.respond('tent','next');assert.equal(requests,0);
 }finally{delete globalThis.window;delete globalThis.location;}
});
