import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clearRectangle,clearableKeys,clearTargets} from '../src/clear-area.mjs';
import {initialState,applyAction} from '../src/core.mjs';
import {BuildAsk} from '../src/build-ask.js';
import {LivingFriend} from '../src/living-friend.js';
const world={id:'clear-test',heroStart:[1,1],grid:{origin:[0,0],columns:20,rows:20,mask:Array(400).fill(2),heights:Array(441).fill(.14)},species:{pine:{wood_item:'pine_wood',seed_item:'pine_seed'},apple:{wood_item:'apple_wood',seed_item:'apple_seed'}},trees:[{id:'inside',species:'pine',radius:.3,position:[3.5,3.5]},{id:'outside',species:'pine',radius:.3,position:[12.5,12.5]},{id:'fruit',species:'apple',position:[4.5,4.5]}],boulders:[{id:'rock',deposit:'stone',radius:.3,position:[5.5,3.5],maxHealth:3}],seeds:[]};
function setup(){
 const state=initialState(world);state.clock.paused=true;state.characters.you={name:'You',energy:100};state.activeCharacter='you';state.community={members:{adam:{position:{x:2,y:2}}}};
 const h={actor:new THREE.Group(),bones:{mixamorigRightHand:new THREE.Group()},can:new THREE.Group(),hammer:new THREE.Group(),bench:new THREE.Group()};h.actor.add(h.bones.mixamorigRightHand);h.actor.position.set(2,.14,-2);
 const g={world,store:{state,save(next){this.state=next;}},scene:new THREE.Scene(),actor:new THREE.Group(),community:{actors:{adam:h}},keys:new Set(),player:state.player,path:[],nav:{approach(pos,target){return [{x:target.x-.7,y:target.y}];}},asset:()=>new THREE.Group(),notify(){},refreshDynamic(){},burst(){},toast(text){this.messages.push(text);},messages:[],enterSiteView(){this.siteView={};},leaveSiteView(){this.siteView=null;}};
 const t={g,state:{adamUnlocked:true,welcomeSeen:true},elapsed:100,garden:{plots:[]},farm:{state:{garden:{completed:false}}}};g.livingTest=t;t.friend=new LivingFriend(t);g.buildAsk=new BuildAsk(g);return {g,t,friend:t.friend,ask:g.buildAsk};
}
test('rectangle is direction independent and bounded before allocating cells',()=>{
 assert.deepEqual(clearRectangle('2:3','4:4'),['2:3','3:3','4:3','2:4','3:4','4:4']);
 assert.deepEqual(clearRectangle('4:4','2:3'),clearRectangle('2:3','4:4'));
 assert.deepEqual(clearRectangle('0:0','99999999:99999999'),[]);
 assert.deepEqual(clearRectangle('bad','2:2'),[]);
});
test('protect gardens, fruit trees, homes and cells outside the chosen box',()=>{
 const {g}=setup();g.store.state.cells['3:3']={soil:'tilled'};
 assert.deepEqual(clearTargets(world,g.store.state,clearRectangle('2:2','6:6')).map(t=>t.id),['rock']);
 assert.deepEqual(clearTargets(world,g.store.state,clearRectangle('2:2','6:6'),['5:3']),[]);
 assert.equal(clearableKeys(world,g.store.state,['-1:0','20:1','3:3','5:3']).join(),'5:3');
 g.store.state.buildings=[{id:'home',kind:'tent',key:'5:3',rotation:0,status:'complete'}];
 assert.ok(!clearableKeys(world,g.store.state,['5:3']).includes('5:3'));
});
test('selection and cancellation do not spend energy, remove resources or create a campfire',()=>{
 const {g,ask}=setup(),before=structuredClone(g.store.state);
 assert.equal(ask.startClearArea(),true);ask.clearSelection('2:2','6:6');assert.equal(ask.card().goEnabled,true);
 ask.decline();assert.deepEqual(g.store.state,before);assert.equal(g.siteView,null);assert.equal(ask.picking,null);
});
test('empty selection cannot confirm; confirmed selection is a clear job, never a building site',()=>{
 const {g,ask}=setup();ask.startClearArea();ask.clearSelection('8:8','9:9');ask.confirm();assert.equal(ask.picking.mode,'clear');assert.equal(g.store.state.livingClearArea,undefined);
 ask.clearSelection('2:2','6:6');ask.confirm();assert.equal(ask.picking,null);assert.deepEqual(g.store.state.livingClearArea.ids,['inside','rock']);assert.equal(g.store.state.village?.buildSites,undefined);assert.deepEqual(g.store.state.buildings,[]);
});
test('Adam clears selected trees, stumps and rocks with real actions, retaining player and outside trees',()=>{
 const {g,t,friend}=setup();friend.clearArea(clearRectangle('2:2','6:6'));
 for(let i=0;i<100&&g.store.state.livingClearArea;i++){t.elapsed+=1;friend.update(1);}
 assert.equal(g.store.state.livingClearArea,null);assert.deepEqual(g.store.state.removedTrees,['inside']);assert.deepEqual(g.store.state.removedStumps,['inside']);assert.deepEqual(g.store.state.removedRocks,['rock']);
 assert.equal(g.store.state.inventory.pine_wood,3);assert.ok(g.store.state.inventory.stone>0);assert.equal(g.store.state.activeCharacter,'you');assert.deepEqual(g.store.state.player,{x:1,y:1});assert.equal(g.store.state.characters.you.energy,100);assert.ok(g.store.state.characters.adam.energy<100);
});
test('low energy pauses a saved plan, a new helper instance resumes after energy returns',()=>{
 const {g,t,friend}=setup();g.store.state.characters.adam.energy=0;friend.clearArea(['3:3']);friend.nextClearJob();assert.equal(friend.job,null);assert.ok(g.store.state.livingClearArea);assert.match(g.messages.at(-1),/energy/);
 g.store.state.characters.adam.energy=100;const restored=new LivingFriend(t);restored.nextClearJob();assert.equal(restored.job.id,'inside');
});
test('newly protected ground is rechecked before any action is committed',()=>{
 const {g,t,friend}=setup();friend.clearArea(['3:3']);friend.nextClearJob();g.store.state.cells['3:3']={soil:'tilled'};
 for(let i=0;i<10;i++){t.elapsed++;friend.update(1);}assert.deepEqual(g.store.state.removedTrees,[]);
});
test('full wood storage and unreachable ground report a pause instead of claiming completion',()=>{
 const {g,friend}=setup();g.store.state.inventory.pine_wood=200;friend.clearArea(['3:3']);friend.nextClearJob();assert.equal(friend.job,null);assert.match(g.messages.at(-1),/storage is full/);
 g.store.state.inventory.pine_wood=0;friend.clearRetryAt=0;g.nav.approach=()=>null;friend.nextClearJob();assert.match(g.messages.at(-1),/reach/);assert.ok(g.store.state.livingClearArea);
});

test('interrupted drags restore the prior selection, and pointer release stops drawing',()=>{
 const {ask}=setup();ask.startClearArea();ask.clearSelection('3:3','3:3');
 ask.eventCell=e=>e.key;
 const event=(type,key)=>({type,key,button:0,pointerId:1,isPrimary:true,currentTarget:{setPointerCapture(){},hasPointerCapture:()=>false}});
 ask.clearPointer(event('pointerdown','4:4'));ask.clearPointer(event('pointermove','6:6'));ask.cancelClearDrag();assert.deepEqual(ask.picking.keys,['3:3']);
 ask.clearPointer(event('pointerdown','5:3'));ask.clearPointer(event('pointerup','5:3'));ask.clearPointer(event('pointermove','9:9'));assert.deepEqual(ask.picking.keys,['5:3']);
});
test('mineral tool requirements are honored and Take a break stops the queued area',()=>{
 const {g,t,friend}=setup();g.world={...world,boulders:[{...world.boulders[0],deposit:'diamond'}]};friend.clearArea(['5:3']);friend.nextClearJob();assert.equal(friend.job,null);assert.match(g.messages.at(-1),/stronger tools/);
 g.store.state.tools.tier=2;t.elapsed+=11;friend.nextClearJob();assert.equal(friend.job.type,'mine_hit');friend.assign('stop');assert.equal(friend.job,null);assert.equal(g.store.state.livingClearArea,null);
});
