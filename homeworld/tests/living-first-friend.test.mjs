import test from 'node:test';
import assert from 'node:assert/strict';
import {firstFriendKey,readFirstFriend,offerFirstFriend,beginFirstFriendStory,isFirstFriendReading,finishFirstFriendStory} from '../src/living-first-friend.mjs';

const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
test('a first friend cannot be unlocked before the solo achievement and story handoff',()=>{
  const s=memory(),k=firstFriendKey('family:child');
  assert.equal(beginFirstFriendStory(s,k,'genesis','creation'),null);
  assert.equal(finishFirstFriendStory(s,k,'genesis','creation'),false);
  offerFirstFriend(s,k);
  assert.equal(readFirstFriend(s,k).phase,'offered');
  assert.equal(finishFirstFriendStory(s,k,'genesis','creation'),false);
});
test('opening a story grants nothing; only its matching completion unlocks Adam once',()=>{
  const s=memory(),k=firstFriendKey('family:child');offerFirstFriend(s,k);
  beginFirstFriendStory(s,k,'genesis','creation');
  assert.equal(readFirstFriend(s,k).phase,'reading');
  assert.equal(isFirstFriendReading(s,k,'genesis','different'),false);
  assert.equal(finishFirstFriendStory(s,k,'other-island','creation'),false);
  assert.equal(finishFirstFriendStory(s,k,'genesis','creation'),true);
  assert.equal(readFirstFriend(s,k).character,'adam');
  assert.equal(finishFirstFriendStory(s,k,'genesis','creation'),false);
});
test('the handoff stays bound to one story and one child profile',()=>{
  const s=memory(),a=firstFriendKey('family:a'),b=firstFriendKey('family:b');
  offerFirstFriend(s,a);beginFirstFriendStory(s,a,'genesis','creation');
  assert.equal(beginFirstFriendStory(s,a,'genesis','different'),null);
  assert.equal(finishFirstFriendStory(s,b,'genesis','creation'),false);
  offerFirstFriend(s,a);assert.equal(readFirstFriend(s,a).phase,'reading');
  assert.equal(readFirstFriend(s,b),null);
});
test('failed persistence cannot report a successful unlock',()=>{
  const s=memory(),k=firstFriendKey('child');offerFirstFriend(s,k);beginFirstFriendStory(s,k,'genesis','creation');
  s.setItem=()=>{throw Error('quota');};
  assert.equal(finishFirstFriendStory(s,k,'genesis','creation'),false);
  assert.equal(readFirstFriend(s,k).phase,'reading');
});
