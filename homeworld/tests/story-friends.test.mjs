import test from 'node:test';
import assert from 'node:assert/strict';
import {waitingStoryFriends,collectedStoryFriends,LIVING_RESIDENT_MESSAGES} from '../../shared/storyFriends.mjs';
import {Residents,RESIDENTS_KEY} from '../src/residents.js';
const eve={id:'reward-eve',name:'Eve'},adam={id:'reward-adam',name:'Adam'};
test('saved waiting friends survive reload and disappear only after arriving',()=>{
 const collected=JSON.parse(JSON.stringify([adam,eve]));
 assert.deepEqual(waitingStoryFriends(collected,[],true),[eve]);
 assert.deepEqual(waitingStoryFriends(collected,[{...eve,x:1,y:1}],true),[]);
 assert.deepEqual(waitingStoryFriends(collected,[],false),[adam,eve]);
});
test('claim navigation contains only saved character rewards, never coins or unclaimed characters',()=>{
 const pool=[{id:'coins',type:'coins'},{id:eve.id,type:'character'},{id:'missing',type:'character'}];
 assert.deepEqual(collectedStoryFriends(pool,[adam,eve]),[eve]);
 assert.deepEqual(collectedStoryFriends(pool,[]),[]);
});
test('living bridge permits arrivals but not remote possession or task execution',()=>{
 for(const type of ['gk-resident-drop','gk-friends-waiting','gk-residents-sync'])assert.ok(LIVING_RESIDENT_MESSAGES.has(type));
 for(const type of ['gk-resident-select','gk-task','gk-player-control'])assert.equal(LIVING_RESIDENT_MESSAGES.has(type),false);
});
test('bed count includes managed Adam and duplicate drop is a no-op',()=>{
 const values=new Map([[RESIDENTS_KEY,JSON.stringify([{...eve,x:1,y:1}])]]);
 globalThis.localStorage={getItem:k=>values.get(k)||null};
 globalThis.window={parent:null};
 const residents=Object.create(Residents.prototype);
 residents.game={livingTest:{friendEarned:true},store:null};
 assert.equal(residents.bedStatus().residents,2);assert.equal(residents.bedStatus().canDrop,false);
 assert.doesNotThrow(()=>residents.beginDrop(eve));assert.equal(residents.placing,undefined);
 delete globalThis.localStorage;delete globalThis.window;
});
