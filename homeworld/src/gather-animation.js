import * as THREE from 'three';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export const GATHER_TIMING={take:.45,chop:.95,plow:1.1,clear_weeds:1.1,dig_stump:1.1,dig_mud:1.0,impact:.66,recover:.6};
const mix=(a,b,k)=>a.map((v,i)=>THREE.MathUtils.lerp(v,b[i],k));
export function gatherSample(type,t,hits,reach,scale=1){
 const hoe=['plow','clear_weeds','dig_stump','dig_mud'].includes(type),cycle=GATHER_TIMING[type]*(scale||1),active=Math.max(0,t-GATHER_TIMING.take),index=Math.floor(active/cycle),phase=active/cycle-index,end=GATHER_TIMING.take+hits*cycle,duration=end+GATHER_TIMING.recover;
 const hip={w:[-.28,.86,.06],h:[.12,.25,.3],dip:0,bend:0,twist:0};
 const follow={w:[0,hoe?.78:1.02,.42],h:[0,hoe?.035:.83,reach],dip:hoe?.15:.055,bend:hoe?.30:.16,twist:hoe?0:.11};
 const up={w:[0,hoe?1.03:1.25,.24],h:hoe?[-.08,1.65,.72]:[-.28,1.95,.10],dip:hoe?.055:.015,bend:hoe?.12:.035,twist:hoe?-.035:-.14};
 const hit={w:[0,hoe?.82:1.06,.43],h:[0,hoe?.015:.95,reach],dip:hoe?.17:.065,bend:hoe?.34:.19,twist:hoe?.025:.12};
 const blend=(a,b,k)=>({w:mix(a.w,b.w,k),h:mix(a.h,b.h,k),dip:THREE.MathUtils.lerp(a.dip,b.dip,k),bend:THREE.MathUtils.lerp(a.bend,b.bend,k),twist:THREE.MathUtils.lerp(a.twist,b.twist,k)});
 let pose;if(t<GATHER_TIMING.take)pose=blend(hip,follow,ease(t/GATHER_TIMING.take));else if(index>=hits)pose=blend(follow,hip,ease((t-end)/GATHER_TIMING.recover));else if(phase<.42)pose=blend(follow,up,ease(phase/.42));else if(phase<.66)pose=blend(up,hit,ease((phase-.42)/.24));else pose=blend(hit,follow,ease((phase-.66)/.34));
 return {...pose,phase,duration,due:Math.max(0,Math.min(hits,Math.floor((t-GATHER_TIMING.take-cycle*GATHER_TIMING.impact)/cycle)+1))};
}
function gripAt(hand){return hand.localToWorld(V(0,.065,0));}
function aimHand(game,side,target){const hand=game.bones[`mixamorig${side}Hand`];for(let i=0;i<5;i++){game.actor.updateMatrixWorld(true);const offset=gripAt(hand).sub(hand.getWorldPosition(V(0,0,0)));game.ik(side,target.clone().sub(offset));}game.actor.updateMatrixWorld(true);}
export function animateGathering(game,dt){
 const a=game.action;a.t+=dt*(game.animationRate??1)*(game.nutrition?.workRate?.()??1);const hits=a.workHits||2,hoe=['plow','clear_weeds','dig_stump','dig_mud'].includes(a.type),distance=Math.hypot(a.target.x-game.player.x,a.target.y-game.player.y),reach=THREE.MathUtils.clamp(distance-(hoe?0:(a.tree?.radius||.1)*.3),.6,1.4),pose=gatherSample(a.type,a.t,hits,reach,hoe?(a.digScale||1):1),tool=game.tools[hoe?'hoe':'axe'];
 game.idlePose?.apply(game.bones,Date.now()/1000);game.actor.updateMatrixWorld(true);
 const feet=['Right','Left'].map(side=>{const foot=game.bones[`mixamorig${side}Foot`];return {side,foot,p:foot.getWorldPosition(V(0,0,0)),q:foot.getWorldQuaternion(Q())};});
 game.bones.mixamorigHips.position.y-=pose.dip;game.bones.mixamorigSpine?.rotateX(pose.bend);game.bones.mixamorigSpine?.rotateY(pose.twist);game.bones.mixamorigHead?.rotateY(-pose.twist*.35);game.actor.updateMatrixWorld(true);
 for(const f of feet){game.solveChain([game.bones[`mixamorig${f.side}Leg`],game.bones[`mixamorig${f.side}UpLeg`]],f.foot,f.p);f.foot.quaternion.copy(f.foot.parent.getWorldQuaternion(Q()).invert().multiply(f.q));f.foot.updateWorldMatrix(false,true);}
 const c=tool.userData.contact_local||[.3,.72,0],contact=V(c[0],c[2],-c[1]),length=contact.clone().multiply(tool.scale).length(),head=game.localPoint(pose.h),hint=game.localPoint(pose.w),desiredGrip=head.clone().add(hint.sub(head).normalize().multiplyScalar(length));
 aimHand(game,'Right',desiredGrip);const grip=gripAt(game.bones.mixamorigRightHand);tool.visible=true;tool.position.copy(grip);tool.quaternion.setFromUnitVectors(contact.clone().normalize(),head.clone().sub(grip).normalize());tool.updateMatrixWorld(true);
 const support=tool.localToWorld(V(0,0,hoe?-.16:-.10)),supportWeight=ease(a.t/GATHER_TIMING.take)*ease((pose.duration-a.t)/GATHER_TIMING.recover),left=gripAt(game.bones.mixamorigLeftHand);aimHand(game,'Left',left.lerp(support,supportWeight));a.poseAudit={head:head.clone(),grip:grip.clone(),support:support.clone(),phase:pose.phase};
 while(a.hits<pose.due&&!a.failed&&!a.broken){a.hits++;if(!hoe&&game.store&&a.id)game.strikeTree(a);else{game.burst(a.target,hoe?'dirt':'wood',hoe?.18:.95);game.status=`${hoe?(a.shovelName?`Digging with your ${a.shovelName} shovel`:'Digging'):'Chopping'} · ${a.hits} / ${hits}`;game.notify();}if(a.broken)a.brokenAt=a.t;}
 if(!hoe&&game.workTree){if(a.broken){const fall=ease((a.t-(a.brokenAt??a.t)-.08)/.65),direction=V(a.target.x-game.player.x,0,-a.target.y+game.player.y).normalize();game.workTree.quaternion.setFromAxisAngle(V(direction.z,0,-direction.x),fall*1.4);game.workTree.visible=fall<.98;}else game.workTree.rotation.z=Math.sin(pose.phase*30)*.012*(pose.phase>.6?1:0);}
 if(a.failed||a.t>=pose.duration)game.finishAction();
}
