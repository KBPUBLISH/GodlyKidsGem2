import test from 'node:test';
import assert from 'node:assert/strict';
import {firstFriendKey,readFirstFriend,offerFirstFriend,startFirstFriendVoyage,beginFirstFriendPack,beginFirstFriendStory,finishFirstFriendStory,claimFirstFriend,prepareFirstFriendDrop,placeFirstFriend} from '../src/living-first-friend.mjs';
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
const reading=(s,k)=>{offerFirstFriend(s,k);startFirstFriendVoyage(s,k);beginFirstFriendPack(s,k,'genesis','creation');beginFirstFriendStory(s,k,'genesis','creation');};
test('every step is explicit: ship, Genesis story, Adam aboard, then island placement',()=>{
 const s=memory(),k=firstFriendKey('child');
 assert.equal(startFirstFriendVoyage(s,k),null);assert.equal(beginFirstFriendStory(s,k,'genesis','creation'),null);
 offerFirstFriend(s,k);assert.equal(beginFirstFriendStory(s,k,'genesis','creation'),null);
 assert.equal(startFirstFriendVoyage(s,k).phase,'ship');assert.equal(beginFirstFriendPack(s,k,'genesis','creation').phase,'pack');
 assert.equal(claimFirstFriend(s,k,'genesis','creation'),false);assert.equal(prepareFirstFriendDrop(s,k),false);
 assert.equal(beginFirstFriendStory(s,k,'genesis','creation').phase,'reading');
 assert.equal(finishFirstFriendStory(s,k,'other','creation'),false);
 assert.equal(finishFirstFriendStory(s,k,'genesis','creation'),true);assert.equal(readFirstFriend(s,k).phase,'reward');assert.equal(readFirstFriend(s,k).character,undefined);
 assert.equal(placeFirstFriend(s,k,{x:1,y:1}),false);assert.equal(claimFirstFriend(s,k,'genesis','creation'),true);
 assert.equal(readFirstFriend(s,k).phase,'aboard');assert.equal(prepareFirstFriendDrop(s,k),true);
 assert.equal(placeFirstFriend(s,k,{x:NaN,y:1}),false);assert.equal(placeFirstFriend(s,k,{x:1,y:2}),true);
 assert.deepEqual(readFirstFriend(s,k).position,{x:1,y:2});assert.equal(readFirstFriend(s,k).phase,'placed');
 assert.equal(placeFirstFriend(s,k,{x:3,y:4}),false);assert.equal(startFirstFriendVoyage(s,k),null);
});
test('the saved journey remains bound to one story and one child through reloads',()=>{
 const s=memory(),a=firstFriendKey('family:a'),b=firstFriendKey('family:b');reading(s,a);
 assert.equal(beginFirstFriendPack(s,a,'genesis','different'),null);assert.equal(beginFirstFriendStory(s,a,'other','creation'),null);
 assert.equal(finishFirstFriendStory(s,b,'genesis','creation'),false);assert.equal(readFirstFriend(s,b),null);
 assert.equal(offerFirstFriend(s,a).phase,'reading');assert.equal(startFirstFriendVoyage(s,a).phase,'reading');
 assert.equal(beginFirstFriendPack(s,a,'genesis','creation').phase,'reading');
});
test('failed persistence never reports a reward or placement',()=>{
 const s=memory(),k=firstFriendKey('child');reading(s,k);const write=s.setItem;s.setItem=()=>{throw Error('quota');};
 assert.equal(finishFirstFriendStory(s,k,'genesis','creation'),false);assert.equal(readFirstFriend(s,k).phase,'reading');
 s.setItem=write;finishFirstFriendStory(s,k,'genesis','creation');claimFirstFriend(s,k,'genesis','creation');prepareFirstFriendDrop(s,k);
 s.setItem=()=>{throw Error('quota');};assert.equal(placeFirstFriend(s,k,{x:1,y:2}),false);assert.equal(readFirstFriend(s,k).phase,'placing');
});
test('children who already unlocked Adam keep their original receipt',()=>{
 const s=memory(),k=firstFriendKey('child'),old={version:1,phase:'unlocked',character:'adam',islandId:'genesis',storyId:'creation'};s.setItem(k,JSON.stringify(old));
 assert.deepEqual(readFirstFriend(s,k),old);assert.deepEqual(offerFirstFriend(s,k),old);assert.equal(startFirstFriendVoyage(s,k),null);
});
