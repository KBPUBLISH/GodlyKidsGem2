import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nextResidentLine,rememberResidentAction,rememberCompletedBuildings,residentPersonality} from '../src/resident-dialogue.mjs';
import {GameStore,initialState,SAVE_KEY} from '../src/core.mjs';

const adam={id:'story-adam',name:'Adam'}, noah={id:'story-noah',name:'Noah'};
const wall=Date.now(), step=10000;
const empty=()=>({cells:{},stats:{},buildings:[],animals:[],revision:0});
const context={residents:[adam,noah],plants:[],buildings:[]};
const greet=(state,person=adam,ctx=context,at=wall)=>nextResidentLine(state,person,ctx,at);
function planted(state,key='1:1',seed='carrot_seed',at=wall+1){
  return rememberResidentAction(state,{...state,cells:{...state.cells,[key]:{seed,plantedAt:480}},stats:{planted:1}},
    {type:'plant',key,seed,actionId:`plant:${at}`},{actorId:adam.id,wall:at});
}

test('first welcome is one sentence, holds steady on rapid taps, and survives serialization',()=>{
  const first=greet(empty());
  assert.match(first.line.text,/home together/);
  const saved=JSON.parse(JSON.stringify(first.state));
  const again=greet(saved,adam,context,wall+500);
  assert.equal(again.state,saved);
  assert.equal(again.line.text,first.line.text);
  assert.notEqual(greet(saved,adam,context,wall+step).line.text,first.line.text);
});

test('each resident remembers their own conversations and keeps a consistent personality',()=>{
  let state=empty();const lines=[];
  for(let i=0;i<10;i++){const result=greet(state,adam,context,wall+i*step);lines.push(result.line.text);state=result.state;}
  assert.equal(new Set(lines).size,10);
  assert.match(greet(state,noah,context,wall+11*step).line.text,/home together/);
  assert.equal(residentPersonality(adam),'gardener');
  assert.equal(residentPersonality(noah),'builder');
});

test('a real planting becomes a remembered conversation and follows the same plant as it grows',()=>{
  let state=planted(greet(empty()).state);
  const noticed=greet(state,adam,context,wall+step);
  assert.match(noticed.line.text,/carrot seeds you planted/);
  state=JSON.parse(JSON.stringify(noticed.state));
  const grown=greet(state,adam,{...context,plants:[{key:'1:1',seed:'carrot_seed',plantedAt:480,ready:true}]},wall+2*step);
  assert.match(grown.line.text,/Remember.*all grown now/);
  assert.doesNotMatch(greet(grown.state,adam,context,wall+3*step).line.text,/all grown now/);
});

test('a replanted or removed crop cannot masquerade as the plant a resident remembers',()=>{
  const state=greet(planted(greet(empty()).state),adam,context,wall+step).state;
  const otherCrop={key:'1:1',seed:'carrot_seed',plantedAt:900,ready:true};
  assert.doesNotMatch(greet(state,adam,{...context,plants:[otherCrop]},wall+2*step).line.text,/all grown now/);
  assert.doesNotMatch(greet(state,adam,context,wall+2*step).line.text,/all grown now/);
});

test('helpers get credit for their actual work and other residents can mention them',()=>{
  let state=greet(greet(empty()).state,noah,context).state;
  state=rememberResidentAction(state,{...state,stats:{fishCaught:1}},{type:'fish',actionId:'helper-fish'},{actorId:noah.id,helper:true,wall});
  assert.match(greet(state,noah,context,wall+step).line.text,/^I caught a fish/);
  assert.match(greet(state,adam,context,wall+step).line.text,/^Noah caught a fish/);
  assert.doesNotMatch(greet(state,adam,{...context,residents:[adam]},wall+step).line.text,/Noah caught|I caught/);
});

test('no-op actions and partial tree swings cannot create accomplishment stories',()=>{
  const state=empty();
  assert.equal(rememberResidentAction(state,state,{type:'fish'},{actorId:noah.id}),state);
  const after={...state,treeDamage:{oak:1}};
  assert.equal(rememberResidentAction(state,after,{type:'chop_hit'},{actorId:noah.id}),after);
});

test('completed construction is remembered, unfinished work is never reported as finished',()=>{
  const state=greet(empty()).state;
  const building={id:'new-home',kind:'hut',status:'building',name:'Small Hut'};
  const unfinished={...state,buildings:[building]};
  assert.equal(rememberCompletedBuildings(state,unfinished,wall),unfinished);
  const complete={...building,status:'complete'};
  const finished=rememberCompletedBuildings(unfinished,{...unfinished,buildings:[complete]},wall);
  assert.match(greet(finished,adam,{...context,buildings:[complete]},wall+step).line.text,/small hut is finished/);
  assert.doesNotMatch(greet(finished,adam,{...context,buildings:[]},wall+step).line.text,/is finished/);
  assert.equal(rememberCompletedBuildings(finished,finished,wall),finished);
});

test('returning without gameplay never fabricates work while the player was away',()=>{
  const state=greet(empty()).state;
  const result=greet(state,adam,context,wall+86400000);
  assert.equal(result.state.islandConversations.events.length,0);
  assert.doesNotMatch(result.line.text,/watered|caught|finished|while you were away|missed you/);
});

test('new neighbors are acknowledged without attributing invented actions to them',()=>{
  const state=greet(empty(),adam,{...context,residents:[adam]}).state;
  assert.match(greet(state,adam,context,wall+step).line.text,/Noah is part of our island now/);
});

test('memory stays bounded and handles an older or malformed optional memory record',()=>{
  let state=empty();
  for(let i=0;i<100;i++)state=rememberResidentAction(state,{...state,stats:{fishCaught:i+1}},{type:'fish',actionId:`fish:${i}`},{actorId:adam.id,wall});
  assert.equal(state.islandConversations.events.length,40);
  for(let i=0;i<70;i++)state=greet(state,{id:`friend-${i}`,name:'Friend'},context,wall+i*step).state;
  assert.equal(Object.keys(state.islandConversations.residents).length,64);
  assert(greet({...empty(),islandConversations:{version:1,events:null,residents:[]}}).line.text);
  assert(greet({...empty(),islandConversations:{version:999}}).line.text);
});

const world=JSON.parse(fs.readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url),'utf8'));
function fixture(playersOnly=true){
  const saved=new Map(),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v))};
  const s=initialState(world,wall);
  s.activeCharacter=adam.id;s.characters={[adam.id]:{name:'Adam',energy:100},[noah.id]:{name:'Noah',energy:100}};
  s.starterGarden=1;s.cells={'1:1':{soil:'tilled'}};
  storage.setItem(SAVE_KEY,JSON.stringify(s));
  return {store:new GameStore(world,storage,wall,{playersOnly}),storage};
}

test('actual GameStore actions and helper actions persist correctly attributed memories',()=>{
  const {store,storage}=fixture();
  store.residentLine(adam,context,wall);
  store.commit({type:'plant',key:'1:1',seed:'carrot_seed',actionId:'real-plant'},wall+1);
  assert.equal(store.state.islandConversations.events.at(-1).actorId,adam.id);
  store.commitAs(noah.id,noah.name,store.state.player,{type:'water',key:'1:1',actionId:'real-water'},wall+2);
  assert.equal(store.state.activeCharacter,adam.id);
  assert.equal(store.state.islandConversations.events.at(-1).actorId,noah.id);
  assert.equal(store.state.islandConversations.events.at(-1).helper,true);
  const reopened=new GameStore(world,storage,wall+step,{playersOnly:true});
  assert.equal(reopened.error,'');
  assert.match(reopened.residentLine(adam,context,wall+step).text,/Noah watered/);
});

test('failed storage leaves the live save and conversation memory unchanged',()=>{
  const {store,storage}=fixture();
  const before=store.state;
  storage.setItem=()=>{throw Error('full');};
  assert.throws(()=>store.residentLine(adam,context,wall),/Saving is unavailable/);
  assert.equal(store.state,before);
  assert.equal(store.state.islandConversations,undefined);
});

test('reset removes this world’s conversation memories and restore brings them back',()=>{
  const {store}=fixture();
  store.residentLine(adam,context,wall);
  store.reset(wall+step);
  assert.equal(store.state.islandConversations,undefined);
  store.undoReset(wall+2*step);
  assert.match(store.state.islandConversations.residents[adam.id].lastText,/home together/);
});

test('standalone island gameplay does not acquire Players World conversation memory',()=>{
  const {store}=fixture(false);
  store.commit({type:'plant',key:'1:1',seed:'carrot_seed',actionId:'standalone-plant'},wall);
  assert.equal(store.state.islandConversations,undefined);
  assert.equal(store.residentLine(adam,context,wall),null);
});
