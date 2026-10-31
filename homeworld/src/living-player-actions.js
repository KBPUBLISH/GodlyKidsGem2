import * as THREE from 'three';
import {heightAt,SEEDS} from './core.mjs';
import {resetAnimatedPose,preparePlayerCrouch} from './character-motion.js';
import {farmActionSample} from './living-action-motion.mjs';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();

/** Lightweight hand props and continuous seed/water motion; never awards items. */
export class LivingPlayerActions {
 constructor(test){
  this.test=test;this.g=test.g;this.owner=null;this.tool=null;
  this.group=new THREE.Group();this.g.scene.add(this.group);this.group.visible=false;
  this.geometry=new THREE.SphereGeometry(1,8,6);
  this.materials={water:new THREE.MeshStandardMaterial({color:'#a1eeff',emissive:'#276e88',emissiveIntensity:.25,roughness:.25}),seed:new THREE.MeshStandardMaterial({color:'#f9d587',roughness:.8}),crop:new THREE.MeshStandardMaterial({color:'#ed8a2b',roughness:.8}),leaf:new THREE.MeshStandardMaterial({color:'#78b847',roughness:.8})};
  const dot=(material,scale)=>{const m=new THREE.Mesh(this.geometry,this.materials[material]);m.scale.set(...scale);this.group.add(m);return m;};
  this.drops=Array.from({length:18},()=>dot('water',[.025,.045,.025]));
  this.seeds=Array.from({length:6},()=>dot('seed',[.025,.035,.021]));
  this.crop=new THREE.Group();this.group.add(this.crop);
  const carrot=new THREE.Mesh(this.geometry,this.materials.crop);carrot.scale.set(.07,.16,.07);this.crop.add(carrot);
  for(const side of [-1,1]){const leaf=new THREE.Mesh(this.geometry,this.materials.leaf);leaf.position.set(side*.04,.17,0);leaf.scale.set(.025,.09,.025);leaf.rotation.z=side*.4;this.crop.add(leaf);}
 }
 clear(owner=this.owner){
  if(owner!==this.owner)return;
  if(this.tool)this.tool.visible=false;this.tool=null;this.owner=null;this.group.visible=false;
 }
 update(){if(this.owner&&this.owner!==this.g.action&&this.owner!==this.test.garden?.work)this.clear();}
 animate(action,dt){
  action.t+=dt*(this.g.animationRate??1)*(this.g.nutrition?.workRate?.()??1);
  const pose=this.pose(action,action.type,action.t,action.target);
  if(pose?.done){this.clear(action);this.g.finishAction();}
 }
 pose(owner,kind,time,target){
  const p=farmActionSample(kind,time);if(!p)return null;
  const g=this.g,b=g.bones;
  if(this.owner!==owner){
   this.clear();
   if(this.heldCrop){this.group.remove(this.heldCrop);this.heldCrop=null;}
   if(kind==='harvest'){
    const plot=Number.isInteger(owner.index)?this.test.garden?.plots[owner.index]:null;
    const plant=SEEDS.find(seed=>seed.id===g.store.state.cells[owner.key]?.seed)?.plant;
    const source=plot?.cropObject||(plant&&g.library[`crop_${plant}_ready`]);
    if(source){this.heldCrop=source.clone(true);this.heldCrop.scale.setScalar(.42);this.group.add(this.heldCrop);}
   }
  }
  this.owner=owner;
  resetAnimatedPose(g);
  if(Math.hypot(target.x-g.player.x,target.y-g.player.y)>.05)g.actor.rotation.y=Math.atan2(target.x-g.player.x,-(target.y-g.player.y));
  g.actor.updateMatrixWorld(true);
  const feet=['Right','Left'].map(side=>({side,bone:b[`mixamorig${side}Foot`],p:b[`mixamorig${side}Foot`].getWorldPosition(V()),q:b[`mixamorig${side}Foot`].getWorldQuaternion(Q())}));
  b.mixamorigHips.position.y-=p.dip;b.mixamorigSpine.rotation.x=p.bend;b.mixamorigHead.rotation.x=p.headNod;
  g.actor.updateMatrixWorld(true);
  preparePlayerCrouch(g,p.dip);
  for(const f of feet){g.solveChain([b[`mixamorig${f.side}Leg`],b[`mixamorig${f.side}UpLeg`]],f.bone,f.p);f.bone.quaternion.copy(f.bone.parent.getWorldQuaternion(Q()).invert().multiply(f.q));f.bone.updateWorldMatrix(false,true);}
  const reach=Math.max(.35,Math.min(.85,Math.hypot(target.x-g.player.x,target.y-g.player.y)));
  const right=[...p.right],left=[...p.left];right[1]+=p.pat;
  if(kind!=='water'){right[2]*=reach/.6;left[2]*=reach/.6;}
  g.ik('Right',g.localPoint(right));g.ik('Left',g.localPoint(left));g.actor.updateMatrixWorld(true);
  const rh=b.mixamorigRightHand.getWorldPosition(V()),lh=b.mixamorigLeftHand.getWorldPosition(V()),soil=V(target.x,heightAt(g.world,target.x,target.y)+.07,-target.y);
  const tool=kind==='water'?g.tools.watering_can:kind==='plant'?g.tools.seed_pouch:null;
  if(this.tool&&this.tool!==tool)this.tool.visible=false;this.tool=tool;
  let spout=rh;
  if(tool){
   tool.visible=true;tool.position.copy(kind==='water'?rh:lh);
   if(kind==='water'){
    const c=tool.userData.contact_local||[.3,.72,0],contact=V(c[0],c[2],-c[1]);
    const aim=g.localPoint([.12,.75-p.tilt*.65,.9]).sub(rh).normalize();
    tool.quaternion.setFromUnitVectors(contact.clone().normalize(),aim);
    tool.updateMatrixWorld(true);spout=tool.localToWorld(contact);
   }else{tool.quaternion.copy(g.actor.quaternion);tool.rotateX(-.12);tool.updateMatrixWorld(true);}
  }
  this.group.visible=true;
  this.drops.forEach((drop,i)=>{
   drop.visible=p.pour>.02;if(!drop.visible)return;
   const f=(time*2.4+i/this.drops.length)%1,spread=.035+f*.08;
   drop.position.copy(spout).lerp(soil,f);drop.position.x+=Math.sin(i*2.4)*spread;drop.position.z+=Math.cos(i*2.4)*spread;drop.position.y+=.09*Math.sin(f*Math.PI);
  });
  this.seeds.forEach((seed,i)=>{
   seed.visible=p.seeds;if(!seed.visible)return;const f=(time*2.8+i/6)%1;
   seed.position.copy(rh).lerp(soil,f);seed.position.x+=Math.sin(i*2.4)*f*.08;seed.position.z+=Math.cos(i*2.4)*f*.08;
  });
  this.crop.visible=p.crop&&!this.heldCrop;
  if(this.heldCrop)this.heldCrop.visible=p.crop;
  if(p.crop){const crop=this.heldCrop||this.crop;crop.position.copy(rh).lerp(lh,.5);crop.rotation.set(-.35,g.actor.rotation.y,0);}
  owner.poseAudit={kind,phase:p.pour>.02?'pour':p.seeds?'scatter':p.crop?'lift':p.dip>.12?'crouch':'recover',bend:p.bend,dip:p.dip,right:rh.clone(),left:lh.clone(),spout:spout.clone(),footDrift:Math.max(...feet.map(f=>f.bone.getWorldPosition(V()).distanceTo(f.p)))};
  return p;
 }
 dispose(){this.clear();this.g.scene.remove(this.group);this.geometry.dispose();Object.values(this.materials).forEach(m=>m.dispose());}
}
