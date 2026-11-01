import * as THREE from 'three';
import {preparePlayerCrouch} from './character-motion.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const clamp01=t=>t<0?0:t>1?1:t;
/** Leaves the wind-up slower than it arrives, without a dead hang. */
const easeIn=t=>{t=clamp01(t);return .35*t+.65*t*t;};
/** Fast at the start, then settle. Wind-up and recover use this. */
const easeOut=t=>{t=clamp01(t);const u=1-t;return 1-u*u*u;};
export const GATHER_TIMING={take:.45,chop:.84,mine:.95,plow:.65,clear_weeds:1.1,dig_stump:1.1,dig_mud:1.0,impact:.66,chopImpact:.68,recover:.6};
const AXE=.78;
const WIND=.34,HIT=GATHER_TIMING.chopImpact,HOLD=.78;
const mix=(a,b,k)=>a.map((v,i)=>THREE.MathUtils.lerp(v,b[i],k));
const lerp=(a,b,k)=>a+(b-a)*k;
const lerp3=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
const unit=(x,y,z)=>{const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
const nlerp=(a,b,k)=>{const v=lerp3(a,b,k);return unit(v[0],v[1],v[2]);};
const READY={dir:unit(-.2,.78,.58),grip:[-.1,1.04,.18],dip:.03,bend:.08,twist:.08};
const COCK={dir:unit(-.32,.9,-.22),grip:[-.2,1.32,.02],dip:.04,bend:0,twist:-.55};
const HIP={dir:unit(.08,-.08,.98),grip:[-.22,.8,.1],dip:0,bend:0,twist:0};
function strike(reach){
  const dir=unit(.02,-.18,1),z=THREE.MathUtils.clamp(reach-dir[2]*AXE,-.02,.62);
  return {dir,grip:[-.02,.98,z],dip:.08,bend:.24,twist:.32};
}
function pack(dir,grip,body){
  return {w:grip.slice(),h:[grip[0]+dir[0]*AXE,grip[1]+dir[1]*AXE,grip[2]+dir[2]*AXE],dip:body.dip,bend:body.bend,twist:body.twist};
}
function between(a,b,k){
  return pack(nlerp(a.dir,b.dir,k),lerp3(a.grip,b.grip,k),{dip:lerp(a.dip,b.dip,k),bend:lerp(a.bend,b.bend,k),twist:lerp(a.twist,b.twist,k)});
}
/** One axe chop. The head rides a rotated shaft (an arc), not a straight blend. */
function swingPose(phase,reach){
  const hit=strike(reach);
  if(phase<WIND)return between(READY,COCK,easeOut(phase/WIND));
  if(phase<HIT)return between(COCK,hit,easeIn((phase-WIND)/(HIT-WIND)));
  if(phase<HOLD)return pack(hit.dir,hit.grip,hit);
  return between(hit,READY,easeOut((phase-HOLD)/(1-HOLD)));
}
function chopSample(t,hits,reach){
  const cycle=GATHER_TIMING.chop,take=GATHER_TIMING.take,active=Math.max(0,t-take),index=Math.floor(active/cycle),phase=active/cycle-index,end=take+hits*cycle,duration=end+GATHER_TIMING.recover;
  const ready=pack(READY.dir,READY.grip,READY),hip=pack(HIP.dir,HIP.grip,HIP);
  const blend=(a,b,k)=>({w:mix(a.w,b.w,k),h:mix(a.h,b.h,k),dip:lerp(a.dip,b.dip,k),bend:lerp(a.bend,b.bend,k),twist:lerp(a.twist,b.twist,k)});
  let pose,swing;
  if(t<take){pose=blend(hip,ready,ease(t/take));swing='take';}
  else if(index>=hits){pose=blend(ready,hip,ease((t-end)/GATHER_TIMING.recover));swing='lower';}
  else{pose=swingPose(phase,reach);swing=phase<WIND?'wind':phase<HIT?'strike':phase<HOLD?'hold':'recover';}
  return {...pose,phase,duration,swing,due:Math.max(0,Math.min(hits,Math.floor((t-take-cycle*HIT)/cycle)+1))};
}
export function gatherSample(type,t,hits,reach,scale=1){
  if(type==='chop')return chopSample(t,hits,reach);
  const hoe=['plow','clear_weeds','dig_stump','dig_mud'].includes(type),cycle=(GATHER_TIMING[type]??GATHER_TIMING.mine)*(scale||1),active=Math.max(0,t-GATHER_TIMING.take),index=Math.floor(active/cycle),phase=active/cycle-index,end=GATHER_TIMING.take+hits*cycle,duration=end+GATHER_TIMING.recover;
  const hip={w:[-.28,.86,.06],h:[.12,.25,.3],dip:0,bend:0,twist:0};
  const follow={w:[0,hoe?.78:1.02,.42],h:[0,hoe?.035:.83,reach],dip:hoe?.15:.055,bend:hoe?.30:.16,twist:hoe?0:.11};
  const up={w:[0,hoe?1.03:1.25,.24],h:hoe?[-.08,1.65,.72]:[-.28,1.95,.10],dip:hoe?.055:.015,bend:hoe?.12:.035,twist:hoe?-.035:-.14};
  const hit={w:[0,hoe?.82:1.06,.43],h:[0,hoe?.015:.95,reach],dip:hoe?.17:.065,bend:hoe?.34:.19,twist:hoe?.025:.12};
  const blend=(a,b,k)=>({w:mix(a.w,b.w,k),h:mix(a.h,b.h,k),dip:THREE.MathUtils.lerp(a.dip,b.dip,k),bend:THREE.MathUtils.lerp(a.bend,b.bend,k),twist:THREE.MathUtils.lerp(a.twist,b.twist,k)});
  let pose;if(t<GATHER_TIMING.take)pose=blend(hip,follow,ease(t/GATHER_TIMING.take));else if(index>=hits)pose=blend(follow,hip,ease((t-end)/GATHER_TIMING.recover));else if(phase<.42)pose=blend(follow,up,ease(phase/.42));else if(phase<.66)pose=blend(up,hit,ease((phase-.42)/.24));else pose=blend(hit,follow,ease((phase-.66)/.34));
  return {...pose,phase,duration,due:Math.max(0,Math.min(hits,Math.floor((t-GATHER_TIMING.take-cycle*GATHER_TIMING.impact)/cycle)+1))};
}
/** A few degrees, one wobble, then still. t is seconds since the blade landed. */
export function chopShakeRadians(t){
  if(!(t>=0)||t>.5)return 0;
  return Math.sin(t*13.5)*.22*Math.exp(-t*8.5);
}
export function chopHandWeight(t,duration){
  return ease(Math.max(0,t)/GATHER_TIMING.take)*ease(Math.max(0,(duration||0)-t)/GATHER_TIMING.recover);
}
function gripAt(hand){return hand.localToWorld(V(0,.065,0));}
function aimHand(game,side,target){const hand=game.bones[`mixamorig${side}Hand`];for(let i=0;i<5;i++){game.actor.updateMatrixWorld(true);const offset=gripAt(hand).sub(hand.getWorldPosition(V(0,0,0)));game.ik(side,target.clone().sub(offset));}game.actor.updateMatrixWorld(true);}
/** Feet stay where they were. Hips, spine, and both hands drive the tool. Shared by the kid and friends. */
export function applyGatherPose(rig,pose,tool,{hoe=false,supportWeight=1}={}){
  const bones=rig.bones;
  const feet=['Right','Left'].map(side=>{const foot=bones[`mixamorig${side}Foot`];return foot?{side,foot,p:foot.getWorldPosition(V(0,0,0)),q:foot.getWorldQuaternion(Q())}:null;}).filter(Boolean);
  if(bones.mixamorigHips)bones.mixamorigHips.position.y-=pose.dip;
  bones.mixamorigSpine?.rotateX(pose.bend);
  bones.mixamorigSpine?.rotateY(pose.twist);
  bones.mixamorigHead?.rotateY(-pose.twist*.6);
  if(rig.livingTest)bones.mixamorigHead?.rotateX(pose.bend*.25);
  rig.actor.updateMatrixWorld(true);
  preparePlayerCrouch(rig,pose.dip);
  for(const f of feet){rig.solveChain([bones[`mixamorig${f.side}Leg`],bones[`mixamorig${f.side}UpLeg`]],f.foot,f.p);f.foot.quaternion.copy(f.foot.parent.getWorldQuaternion(Q()).invert().multiply(f.q));f.foot.updateWorldMatrix(false,true);}
  const c=tool.userData.contact_local||[.3,.72,0],contact=V(c[0],c[2],-c[1]),length=contact.clone().multiply(tool.scale).length();
  const head=rig.localPoint(pose.h),hint=rig.localPoint(pose.w),gap=hint.clone().sub(head);
  if(gap.lengthSq()<1e-6)gap.set(0,1,0);
  aimHand(rig,'Right',head.clone().add(gap.normalize().multiplyScalar(length)));
  const grip=gripAt(bones.mixamorigRightHand);
  tool.visible=true;tool.position.copy(grip);
  const aim=head.clone().sub(grip);if(aim.lengthSq()<1e-6)aim.set(0,0,1);
  tool.quaternion.setFromUnitVectors(contact.clone().normalize(),aim.normalize());tool.updateMatrixWorld(true);
  const support=tool.localToWorld(V(0,0,hoe?-.16:-.10)),left=gripAt(bones.mixamorigLeftHand);
  aimHand(rig,'Left',left.lerp(support,THREE.MathUtils.clamp(supportWeight,0,1)));
  return {head,grip,support};
}
/** Pale fresh-wood chips plus a few bark chips, at the blade. */
export function emitChopChips(game,point){
  if(!point||!game?.particleGeometry||!game.scene||!game.particleMaterials)return;
  const mats=game.particleMaterials;
  if(!mats.chip)mats.chip=new THREE.MeshStandardMaterial({color:'#fff6e8',roughness:.35});
  const burst=(kind,n,kick)=>{
    const mat=mats[kind];if(!mat)return;
    for(let i=0;i<n;i++){
      const mesh=new THREE.Mesh(game.particleGeometry,mat);
      mesh.position.copy(point);mesh.scale.setScalar((kind==='chip'?0.32:0.42)*(0.75+Math.random()*0.5));
      game.scene.add(mesh);
      game.particles.push({mesh,life:.48,v:V((Math.random()-.5)*kick,.55+Math.random()*1.3,(Math.random()-.5)*kick)});
    }
  };
  burst('chip',6,1.6);burst('wood',3,1.8);
}
/** Tip one instanced tree away from the chopper, then let the caller stop when the wobble is over. */
export function shakeTreeInstance(game,treeId,t,from){
  const ang=chopShakeRadians(t),tree=(game.allTrees||game.trees||[]).find(tr=>tr.id===treeId);
  if(!tree||!game.treeBatches)return ang;
  const dir=V(tree.position[0]-(from?.x||0),0,-(tree.position[1]-(from?.y||0)));
  if(dir.lengthSq()<1e-8)dir.set(0,0,1);
  dir.normalize();
  const yaw=Q().setFromAxisAngle(V(0,1,0),tree.yaw||0),tilt=Q().setFromAxisAngle(V(dir.z,0,-dir.x),ang),rot=tilt.multiply(yaw);
  const matrix=new THREE.Matrix4();
  matrix.compose(V(tree.position[0],tree.position[2]||0,-tree.position[1]),rot,V(tree.scale[0],tree.scale[2],tree.scale[1]));
  for(const batch of game.treeBatches){
    if(batch.species!==tree.species)continue;
    const i=batch.mesh.userData.ids?.indexOf(tree.id)??-1;if(i<0)continue;
    batch.mesh.setMatrixAt(i,matrix.clone().multiply(batch.local));batch.mesh.instanceMatrix.needsUpdate=true;
  }
  return ang;
}
export function animateGathering(game,dt){
  const a=game.action;a.t+=dt*(game.animationRate??1)*(game.nutrition?.workRate?.()??1);const hits=a.workHits||2,hoe=['plow','clear_weeds','dig_stump','dig_mud'].includes(a.type),distance=Math.hypot(a.target.x-game.player.x,a.target.y-game.player.y),reach=THREE.MathUtils.clamp(distance-(hoe?0:(a.tree?.radius||.1)*.3),.6,1.4),pose=gatherSample(a.type,a.t,hits,reach,hoe?(a.digScale||1):1),tool=game.tools[hoe?'hoe':'axe'];
  if(game.livingTest){pose.dip*=1.15;pose.bend*=1.3;pose.twist*=1.25;}
  game.idlePose?.apply(game.bones,Date.now()/1000);game.actor.updateMatrixWorld(true);
  const placed=applyGatherPose(game,pose,tool,{hoe,supportWeight:chopHandWeight(a.t,pose.duration)});
  a.poseAudit={head:placed.head.clone(),grip:placed.grip.clone(),support:placed.support.clone(),phase:pose.phase,swing:pose.swing||''};
  while(a.hits<pose.due&&!a.failed&&!a.broken){
    a.hits++;
    if(!hoe&&game.store&&a.id){a.impactPoint=placed.head.clone();game.strikeTree(a);if(!a.failed)a.shakeT=0;}
    else{game.burst(a.target,hoe?'dirt':'wood',hoe?.18:.95);if(hoe)game.music?.sfx?.play('dig');game.status=`${hoe?(a.shovelName?`Digging with your ${a.shovelName} shovel`:'Digging'):'Chopping'} · ${a.hits} / ${hits}`;game.notify();}
    if(a.broken)a.brokenAt=a.t;
  }
  if(!hoe&&game.workTree){
    const direction=V(a.target.x-game.player.x,0,-(a.target.y-game.player.y));if(direction.lengthSq()<1e-8)direction.set(0,0,1);direction.normalize();
    const axis=V(direction.z,0,-direction.x);
    if(a.broken){const fall=ease((a.t-(a.brokenAt??a.t)-.08)/.65);game.workTree.quaternion.setFromAxisAngle(axis,fall*1.4);game.workTree.visible=fall<.98;}
    else{if(a.shakeT!=null){a.shakeT+=dt;if(a.shakeT>.55)a.shakeT=null;}game.workTree.quaternion.setFromAxisAngle(axis,chopShakeRadians(a.shakeT));}
  }
  if(a.failed||a.t>=pose.duration)game.finishAction();
}
