import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {ADAM_MODEL_URL,adamModelUrl,currentAdamCharacter} from '../../shared/adamModel.mjs';
import {islandBoneName,solidCharacterMaterial} from '../src/character-model.js';
import {createRelaxedIdle} from '../src/character-idle.js';
test('old and missing Adam model URLs resolve to the current Creation reward design',()=>{
 for(const url of ['',null,'/models/test-character.glb','/homeworld/assets/adam.glb','/homeworld/assets/mobile/adam.glb?v=mobile-1','https://app.godlykids.com/homeworld/assets/mobile/adam.glb'])assert.equal(adamModelUrl(url),ADAM_MODEL_URL);
 const cms='https://cdn.example.com/uploads/adam-v3.glb';assert.equal(adamModelUrl(cms),cms);
 const old={id:'onboarding-adam',name:'Adam',modelUrl:'/homeworld/assets/mobile/adam.glb',unlockedAt:123,sourceStoryId:'story'};
 assert.deepEqual(currentAdamCharacter(old),{...old,modelUrl:ADAM_MODEL_URL});assert.equal(old.modelUrl,'/homeworld/assets/mobile/adam.glb');
 const noah={id:'noah',name:'Noah',modelUrl:'/noah.glb'};assert.equal(currentAdamCharacter(noah),noah);
});
test('current Adam uses supported bone names and idle animation',()=>{
 const bytes=readFileSync(new URL('../../public/models/adam-current.glb',import.meta.url));const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const names=new Set(json.nodes.map(n=>islandBoneName(n.name||'')));
 for(const name of ['Head','Spine','RightHand','LeftHand','RightArm','LeftArm'])assert.ok(names.has('mixamorig'+name));
 assert.ok(json.animations.some(a=>/idle/i.test(a.name)));assert.equal(islandBoneName('mixamorig:Head'),'mixamorigHead');
 const bone=new THREE.Bone(),clip=new THREE.AnimationClip('Idle_4',1,[new THREE.QuaternionKeyframeTrack('Head.quaternion',[0,1],[0,0,0,1,0,0,1,0])]);
 createRelaxedIdle([clip]).apply({mixamorigHead:bone},.5);assert.ok(bone.quaternion.z>.5);
});
test('opaque exported character material stays solid while genuine transparency is retained',()=>{
 const solid=new THREE.MeshStandardMaterial({transparent:true,opacity:1,depthWrite:false});solidCharacterMaterial(solid);assert.equal(solid.transparent,false);assert.equal(solid.depthWrite,true);
 const glass=new THREE.MeshStandardMaterial({transparent:true,opacity:.4,depthWrite:false});solidCharacterMaterial(glass);assert.equal(glass.transparent,true);assert.equal(glass.opacity,.4);
});
