import test from 'node:test';
import assert from 'node:assert/strict';
import {deckGesture,DECK_IDLE_GESTURES} from '../components/crew/deckGestures.mjs';
test('deck gestures ease back to the base pose without moving feet',()=>{
 for(const kind of ['wave',...DECK_IDLE_GESTURES]){
  for(const progress of [0,1])for(const angles of Object.values(deckGesture(kind,progress)))assert.ok(angles.every(n=>Math.abs(n)<1e-10));
  for(let p=0;p<=1;p+=.05)for(const [bone,angles] of Object.entries(deckGesture(kind,p))){assert.ok(!/Hips|Leg|Foot/.test(bone));assert.ok(angles.every(n=>Number.isFinite(n)&&Math.abs(n)<2));}
 }
 assert.notDeepEqual(deckGesture('look',.25),deckGesture('nod',.25));assert.ok(deckGesture('wave',.5).mixamorigRightArm[2]<-1);
});
