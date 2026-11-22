import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CharacterWelcome} from '../src/character-welcome.js';
import {Arrivals,PROFILE_SHOWN_KEY} from '../src/arrival-profile.js';
function game(){
 const actor=new THREE.Group();actor.add(new THREE.Mesh(new THREE.BoxGeometry(.8,1.8,.5),new THREE.MeshBasicMaterial()));actor.position.y=.9;actor.rotation.y=.7;
 const camera=new THREE.OrthographicCamera(-5,5,5,-5,.01,200);camera.position.set(4,8,10);
 return {actor,camera,zoom:13,viewYaw:.2,viewPitch:.1,overview:false,focus:new THREE.Vector3(),path:[1],keys:new Set(['w']),treeBatches:[],updateProjection(){},refreshDynamic(){},notify(){},store:{state:{}},residents:{models:new Map([['noah',actor]])}};
}
const storage=()=>{const m=new Map([[PROFILE_SHOWN_KEY,'[]']]);return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('close-up auto-opens chat exactly once and restores camera and orientation',()=>{
 const g=game();let chats=0;const scene=new CharacterWelcome(g,{id:'noah'},g.actor,{onHello:()=>chats++});
 assert.equal(g.path.length,0);assert.equal(g.keys.size,0);
 for(let i=0;i<48;i++)scene.update(.1);
 assert.equal(chats,1);assert.equal(scene.phase,'chat');assert.ok(g.zoom<3);
 scene.hello();scene.update(.1);assert.equal(chats,1);
 scene.restore();scene.restore();assert.equal(g.zoom,13);assert.equal(g.actor.rotation.y,.7);assert.equal(g.viewYaw,.2);
});
test('reduced-motion arrivals skip the zoom animation and have a short handoff',()=>{
 const g=game();let chats=0;const s=new CharacterWelcome(g,{id:'noah'},g.actor,{reduced:true,onHello:()=>chats++});
 s.update(.1);assert.ok(g.zoom<3);for(let i=0;i<15;i++)s.update(.1);assert.equal(chats,1);
 s.restore();
});
test('a hidden page pauses the welcome instead of missing the greeting',()=>{
 globalThis.document={hidden:true};try{const s=new CharacterWelcome(game(),{id:'noah'},null);s.update(10);assert.equal(s.time,0);s.restore();}finally{delete globalThis.document;}
});
test('arrivals queue, retain one welcome per friend, wait for the model, and advance on close',()=>{
 const g=game(),a=new Arrivals(g,storage());
 assert.equal(a.arrive({id:'noah',name:'Noah'}),true);assert.equal(a.arrive({id:'noah'}),false);a.arrive({id:'eve',name:'Eve'});
 const at=a.card.at;a.update(.1,at-1);assert.equal(a.scene,null);a.update(.1,at);assert.equal(a.scene.actor,g.actor);
 assert.equal(a.owns(g.actor),true);assert.equal(a.snapshot().phase,'welcome');a.hello();assert.equal(a.snapshot().phase,'chat');
 a.dismiss();assert.equal(g.zoom,13);assert.equal(a.card.resident.id,'eve');a.update(.1,a.card.at);assert.equal(a.scene,null);
 a.update(.1,a.card.at+12001);assert.ok(a.scene);assert.equal(a.scene.actor,undefined);a.dismiss();assert.equal(a.busy,false);a.dispose();
});
test('Adam welcome finishes by opening his existing chat, without a second welcome modal',()=>{
 const g=game(),calls=[];g.community={actors:{adam:{actor:g.actor,modelReady:true}}};
 g.livingTest={state:{adamUnlocked:true},welcomeAdam:()=>calls.push('welcome'),syncFirstFriend:()=>calls.push('sync'),friend:{chatOpen:false,open(mode,arrival){this.chatOpen=true;calls.push([mode,arrival]);}}};
 globalThis.window={parent:{postMessage(){}},addEventListener(){},removeEventListener(){}};
 try{const a=new Arrivals(g,storage());a.arrive({id:'adam',name:'Adam'});a.update(.1,a.card.at);a.hello();
 assert.deepEqual(calls,['welcome','sync',['chat',true]]);assert.equal(g.zoom,13);a.dispose();}finally{delete globalThis.window;}
});

test('generic arrival opens the parent chat and only a matching trusted close releases it',()=>{
 const messages=[],parent={postMessage:(...args)=>messages.push(args)};
 globalThis.window={parent,addEventListener(){},removeEventListener(){}};globalThis.location={origin:'http://localhost'};
 try{const g=game(),saved=storage(),a=new Arrivals(g,saved);a.arrive({id:'noah',name:'Noah'});a.update(.1,a.card.at);a.hello();a.hello();
 assert.equal(messages.length,1);assert.equal(messages[0][0].arrival,true);assert.equal(messages[0][0].character.id,'noah');
 a.onChatClose({origin:'https://other.test',source:parent,data:{type:'gk-arrival-chat-close',id:'noah'}});assert.equal(a.busy,true);
 a.onChatClose({origin:location.origin,source:parent,data:{type:'gk-arrival-chat-close',id:'eve'}});assert.equal(a.busy,true);
 a.onChatClose({origin:location.origin,source:parent,data:{type:'gk-arrival-chat-close',id:'noah'}});assert.equal(a.busy,false);assert.equal(g.zoom,13);
 const reloaded=new Arrivals(g,saved);assert.equal(reloaded.arrive({id:'noah'}),false);a.dispose();reloaded.dispose();
 }finally{delete globalThis.window;delete globalThis.location;}
});
test('standalone Adam greeting uses the local chat and can release the camera',()=>{
 globalThis.window={addEventListener(){},removeEventListener(){}};window.parent=window;
 try{const g=game();g.livingTest={state:{adamUnlocked:true},welcomeAdam(){},syncFirstFriend(){},friend:{open(){assert.fail('must not open a parent-only chat');}}};
 g.community={actors:{adam:{actor:g.actor,modelReady:true}}};const a=new Arrivals(g,storage());a.arrive({id:'adam',name:'Adam'});a.update(.1,a.card.at);a.hello();assert.equal(a.snapshot().standalone,true);assert.equal(a.scene.restored,false);a.dismiss();assert.equal(g.zoom,13);a.dispose();
 }finally{delete globalThis.window;}
});

test('close-up hides surrounding avatars and restores them and camera clipping afterward',()=>{
 const g=game(),friend=new THREE.Group();friend.add(new THREE.Mesh(new THREE.BoxGeometry(.8,1.8,.5)));friend.position.set(2,0,0);
 const near=g.camera.near,s=new CharacterWelcome(g,{id:'noah'},friend);s.update(.1);assert.equal(g.actor.visible,false);assert.equal(g.camera.near,.05);
 assert.ok(s.eye.x>friend.position.x);s.restore();assert.equal(g.actor.visible,true);assert.equal(g.camera.near,near);
});
