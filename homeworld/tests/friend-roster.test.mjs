import test from 'node:test';
import assert from 'node:assert/strict';
import {islandFriendRoster,nextFriendWatch} from '../src/friend-roster.mjs';
import {profileFor} from '../src/character-profile.mjs';
test('roster includes welcomed story friends without showing Adam twice',()=>{
 assert.deepEqual(islandFriendRoster(false,[]),[]);
 const friends=islandFriendRoster(true,[{id:'reward-adam',name:'Adam'},{id:'noah-1',name:'Noah'}]);
 assert.deepEqual(friends.map(f=>f.name),['Adam','Noah']);assert.equal(friends[1].id,'noah-1');
});
test('watch a named friend stays pinned instead of switching to animals',()=>{
 const choices=[{id:'adam'},{id:'noah-1'},{id:'chicken-1'}];
 assert.equal(nextFriendWatch(choices,'noah-1',1),choices[1]);
 assert.equal(nextFriendWatch(choices,'noah-1',2),choices[1]);
 assert.equal(nextFriendWatch(choices,null,1),choices[2]);
 assert.equal(nextFriendWatch(choices,null,2),choices[0]);
});
test('missing friend and empty island stop watching safely',()=>{
 assert.equal(nextFriendWatch([],'adam'),null);
 assert.equal(nextFriendWatch([{id:'chicken'}],'adam'),null);
});
test('cards use existing game traits and a silly activity',()=>{
 for(const name of ['Adam','Noah','Eve','Abel','Ruth']){const p=profileFor({id:name,name});assert.ok(p.strengths.length);assert.ok(p.weaknesses.length);assert.ok(p.tasks.some(t=>t.silly));}
 assert.deepEqual(profileFor({name:'Adam'}).strengths,['Farming','Mining']);
});

test('portrait cloning supports circular animation metadata without changing the live model',async()=>{
 const {Group,Bone}=await import('three');const {cloneFriendForPortrait}=await import('../src/friend-portraits.js');
 const actor=new Group(),bone=new Bone();actor.add(bone);const controller={actor};actor.userData={controller};bone.userData={actor};
 const original=actor.userData,originalBone=bone.userData;const portrait=cloneFriendForPortrait(actor);
 assert.notEqual(portrait,actor);assert.equal(actor.userData,original);assert.equal(bone.userData,originalBone);assert.equal(actor.children[0],bone);assert.deepEqual(portrait.userData,{});
});
