import test from 'node:test';
import assert from 'node:assert/strict';
import {actionPlaybackRate} from '../src/action-tempo.mjs';
import {farmActionSample,FARM_ACTION_SECONDS} from '../src/living-action-motion.mjs';
test('short farm actions finish sooner with their props and pose cleared',()=>{
 for(const kind of ['plant','water','harvest']){
  let elapsed=0,frames=0;
  while(!farmActionSample(kind,elapsed).done){elapsed+=(1/60)*actionPlaybackRate(kind);frames++;}
  const end=farmActionSample(kind,elapsed);
  assert.ok(frames/60<FARM_ACTION_SECONDS[kind]*.82);
  assert.equal(end.dip,0);assert.equal(end.pour,0);assert.equal(end.seeds,false);assert.equal(end.crop,false);
 }
});
test('fishing interaction, sleep, rest and spoken prayer keep their timing',()=>{
 for(const kind of ['fish','sleep','rest','pray','dine','build'])assert.equal(actionPlaybackRate(kind),1);
 for(const kind of ['chop','mine','plow','pick_apples','eat','grill'])assert.ok(actionPlaybackRate(kind)>1);
});
