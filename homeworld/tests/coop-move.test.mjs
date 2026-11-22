import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LivingFarm} from '../src/living-farm.js';
function setup(){
 const world={id:'move',grid:{origin:[0,0],columns:30,rows:30,mask:Array(900).fill(2),heights:Array(961).fill(0)},trees:[],boulders:[],blockers:[]};
 const state={livingFarm:{coop:1,coopPosition:{x:10,y:10}},cells:{},buildings:[],removedTrees:[],removedRocks:[]};
 const farm=Object.create(LivingFarm.prototype);farm.g={world,store:{state},zoom:13,resize(){},keys:new Set(),path:[],notify(){},toast(){}};farm.test={layout:{farmPad:{x:10,y:10}}};farm.group=new THREE.Group();farm.coop=farm.coopModel(1);farm.group.add(farm.coop);farm.commit=next=>{state.livingFarm=next;return true;};return farm;
}
test('arrows preview green/red without saving; cancel restores original position and model',()=>{
 const f=setup();f.startMove();assert.equal(f.moveValid,true);assert.equal(f.coop.visible,false);
 f.nudgeMove(1,1);assert.deepEqual(f.position,{x:10,y:10});assert.deepEqual(f.moveTarget,{x:10.5,y:10.5});
 f.moveTarget={x:-5,y:-5};f.updateMovePreview();assert.equal(f.moveValid,false);assert.equal(f.confirmMove(),false);assert.deepEqual(f.position,{x:10,y:10});
 f.cancelMove();assert.equal(f.moveGhost,null);assert.equal(f.coop.visible,true);assert.equal(f.g.zoom,13);
});
test('confirmation revalidates and only commits the selected valid spot',()=>{
 const f=setup();f.startMove();f.nudgeMove(1,1);f.g.world.trees=[{id:'t',position:[10.5,10.5],radius:.5}];assert.equal(f.confirmMove(),false);
 f.g.world.trees=[];assert.equal(f.confirmMove(),true);assert.deepEqual(f.position,{x:10.5,y:10.5});assert.equal(f.moving,false);
});
