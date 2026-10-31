import * as THREE from 'three';
export const WALK_SPEED=1.8,WALK_REFERENCE_SPEED=1.5;
const damp=(a,b,k,dt)=>THREE.MathUtils.lerp(a,b,1-Math.exp(-k*dt));
export function turnToward(actor,yaw,dt){const delta=Math.atan2(Math.sin(yaw-actor.rotation.y),Math.cos(yaw-actor.rotation.y));actor.rotation.y+=delta*(1-Math.exp(-12*dt));}
export function resetAnimatedPose(character){
 character.mixer?.stopAllAction();character.currentClip=null;character.clip=null;if(character.locomotion)character.locomotion.weight=0;
 for(const p of character.restPose||[]){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}
}
/** Seed a bent knee before IK: a perfectly straight cartoon leg cannot shorten along its own axis. */
export function preparePlayerCrouch(character,dip){
 if(!character.model?.userData.avatarId||dip<=.0001)return;
 for(const side of ['Right','Left']){
  character.bones[`mixamorig${side}UpLeg`].rotation.x=-.35;
  character.bones[`mixamorig${side}Leg`].rotation.x=.7;
 }
 character.actor.updateMatrixWorld(true);
}
export function updateLocomotion(character,idlePose,dt,speed,seconds){
 if(!character.mixer||!character.clips?.Walking)return;
 let state=character.locomotion;if(!state||state.model!==character.model)state=character.locomotion={model:character.model,weight:0,pose:(character.restPose||[]).map(()=>({p:new THREE.Vector3(),q:new THREE.Quaternion()}))};
 const moving=speed>.035;state.weight=damp(state.weight,moving?1:0,moving?11:9,dt);const action=character.clips.Walking;
 if(state.weight<.002&&!moving){action.stop();state.weight=0;}
 for(const p of character.restPose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}idlePose?.apply(character.bones,seconds);
 if(state.weight>0){
  character.restPose.forEach((p,i)=>{state.pose[i].p.copy(p.bone.position);state.pose[i].q.copy(p.bone.quaternion);});
  if(!action.isRunning()){action.reset().setEffectiveWeight(1).play();}
  const pace=THREE.MathUtils.clamp(speed/WALK_REFERENCE_SPEED,.45,1.5);action.setEffectiveTimeScale(damp(action.getEffectiveTimeScale(),pace,10,dt));if(character.stepMixer)character.stepMixer(character.mixer,dt);else character.mixer.update(dt);
  // Blend from the sampled walk toward idle. slerpQuaternions cannot use its
  // destination as the second input: copying the first would erase the walk.
  character.restPose.forEach((p,i)=>{p.bone.position.lerp(state.pose[i].p,1-state.weight);p.bone.quaternion.slerp(state.pose[i].q,1-state.weight);});
 }
 character.currentClip=character.clip=state.weight>0?'Walking':null;character.actor.updateMatrixWorld(true);
}
export function advancePath(player,path,distance){
 let remaining=distance;
 while(path.length&&remaining>0){const p=path[0],d=Math.hypot(p.x-player.x,p.y-player.y);if(d<=remaining){player.x=p.x;player.y=p.y;path.shift();remaining-=d;}else{player.x+=(p.x-player.x)*remaining/d;player.y+=(p.y-player.y)*remaining/d;remaining=0;}}
}

export function moveCharacter(game,dt){
 const before={...game.player},ready=!game.action&&!game.building?.preview&&!game.store.state.characters[game.store.state.activeCharacter]?.sleep;
 let dx=0,dy=0;
 if(ready&&game.keys.size){dx=(game.keys.has('d')||game.keys.has('ArrowRight')?1:0)-(game.keys.has('a')||game.keys.has('ArrowLeft')?1:0);dy=(game.keys.has('w')||game.keys.has('ArrowUp')?1:0)-(game.keys.has('s')||game.keys.has('ArrowDown')?1:0);}
 const manual=!!(dx||dy);let remaining=0,prev=game.player;
 if(ready&&!manual)for(const p of game.path){remaining+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;}
 const target=manual?WALK_SPEED:Math.min(WALK_SPEED,Math.sqrt(2*4*remaining));
 game.walkSpeed=damp(game.walkSpeed||0,ready?target:0,8,dt);game.manualMoving=false;
 if(manual){
  const length=Math.hypot(dx,dy),p={x:game.player.x+dx/length*game.walkSpeed*dt,y:game.player.y+dy/length*game.walkSpeed*dt},c=game.nav.cell(p);
  game.path=[];game.order=null;game.marker.visible=false;
  if(game.nav.free(c.col,c.row)){Object.assign(game.player,p);game.manualMoving=true;}
 }else if(ready&&game.path.length){advancePath(game.player,game.path,remaining<.015?remaining:game.walkSpeed*dt);}
 const mx=game.player.x-before.x,my=game.player.y-before.y,speed=Math.hypot(mx,my)/Math.max(.0001,dt);
 if(speed>.01)turnToward(game.actor,Math.atan2(mx,-my),dt);
 return speed;
}
