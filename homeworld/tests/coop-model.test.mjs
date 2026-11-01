import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCoopModel} from '../src/coop-model.js';
test('both detailed coops batch geometry and remain inside placement clearance',()=>{
 for(const level of [1,2]){const model=createCoopModel(level);assert.ok(model.children.length<=11);
 let triangles=0;model.traverse(o=>{if(o.isMesh){assert.ok(o.geometry);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));triangles+=o.geometry.attributes.position.count/3;}});
 assert.ok(triangles<6000);const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.x>=-1.8&&bounds.max.x<=1.8);assert.ok(bounds.min.z>=-1.2&&bounds.max.z<=1.85);
 assert.ok(model.children.some(o=>o.userData.coopStep));
 }
});
test('the upgraded coop is visibly taller and no coop renders at level zero',()=>{
 assert.equal(createCoopModel(0).children.length,0);
 const a=new THREE.Box3().setFromObject(createCoopModel(1)),b=new THREE.Box3().setFromObject(createCoopModel(2));assert.ok(b.max.y>a.max.y+.3);
});
