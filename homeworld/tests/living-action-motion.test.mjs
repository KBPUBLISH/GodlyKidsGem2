import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {farmActionSample,FARM_ACTION_SECONDS} from '../src/living-action-motion.mjs';
import {createLivingPlayer} from '../src/living-player-model.js';
import {LIVING_AVATARS} from '../../shared/livingAvatars.mjs';

test('farm motions enter, do the work, and return to standing with effects off',()=>{
 for(const [kind,duration] of Object.entries(FARM_ACTION_SECONDS)){
  const start=farmActionSample(kind,0),end=farmActionSample(kind,duration);
  assert.equal(start.dip,0);assert.equal(end.dip,0);assert.equal(end.bend,0);assert.equal(end.done,true);
  assert.equal(end.pour,0);assert.equal(end.seeds,false);assert.equal(end.crop,false);
  for(let t=0;t<duration;t+=.03){const p=farmActionSample(kind,t);assert.ok([...p.right,...p.left,p.dip,p.bend,p.tilt].every(Number.isFinite));assert.equal(p.done,false);}
 }
 assert.ok(farmActionSample('plant',1).seeds);assert.ok(farmActionSample('water',1).pour>.9);assert.ok(farmActionSample('harvest',1.2).crop);
 assert.equal(farmActionSample('chop',1),null);
});

test('all six scouts bend the upper body independently from their legs and restore their pose',()=>{
 for(const avatar of LIVING_AVATARS){
  const p=createLivingPlayer(avatar.id),b=p.bones;p.model.updateMatrixWorld(true);
  const head=b.mixamorigHead.getWorldPosition(new THREE.Vector3()),hip=b.mixamorigRightUpLeg.getWorldPosition(new THREE.Vector3());
  assert.notEqual(b.mixamorigHead,b.mixamorigSpine2);assert.notEqual(b.mixamorigSpine,b.mixamorigRightUpLeg.parent);
  b.mixamorigSpine.rotation.x=.5;p.model.updateMatrixWorld(true);
  assert.ok(b.mixamorigHead.getWorldPosition(new THREE.Vector3()).distanceTo(head)>.25);
  assert.ok(b.mixamorigRightUpLeg.getWorldPosition(new THREE.Vector3()).distanceTo(hip)<1e-8);
  p.update(.03,0,0);assert.ok(Math.abs(b.mixamorigSpine.rotation.x)<1e-8);p.dispose();
 }
});
