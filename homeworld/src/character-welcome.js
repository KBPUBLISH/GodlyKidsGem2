import * as THREE from 'three';
import {resetAnimatedPose} from './character-motion.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const WELCOME_SECONDS=4.6;
export const REDUCED_WELCOME_SECONDS=1.4;

/** Uses the already loaded island model. No extra model or cinematic download. */
export class CharacterWelcome{
 constructor(game,resident,actor,{reduced=false,onHello=()=>{}}={}){
  this.g=game;this.resident=resident;this.actor=actor;this.reduced=reduced;this.onHello=onHello;this.time=0;this.phase='welcome';this.restored=false;
  this.saved={zoom:game.zoom,yaw:game.viewYaw,pitch:game.viewPitch,overview:game.overview,focus:game.focus.clone(),eye:game.camera.position.clone(),rotation:actor?.rotation.y,near:game.camera.near,far:game.camera.far};
  game.path=[];game.keys.clear();game.livingTest?.garden?.cancel();game.livingTest?.stopWatching?.();
  this.hidden=[];this.hiddenActors=[...new Set([game.actor,...(game.residents?.models?.values()||[])])].filter(a=>a&&a!==actor).map(a=>({actor:a,visible:a.visible}));this.zeroMatrix=new THREE.Matrix4().makeScale(0,0,0);
  if(actor){
   const rig=actor.userData?.bones?actor.userData:game.community?.actors?.[resident.id];
   this.savedPose=(rig?.restPose||[]).map(p=>({bone:p.bone,position:p.bone.position.clone(),quaternion:p.bone.quaternion.clone()}));
   if(rig){
    resetAnimatedPose(rig);
    const calm=game.residents?.calmIdle?.(rig);
    if(calm){calm.reset().play();rig.mixer.update(.01);}else game.idlePose?.apply(rig.bones,0);
   }
   this.welcomePose=(rig?.restPose||[]).map(p=>({bone:p.bone,position:p.bone.position.clone(),quaternion:p.bone.quaternion.clone()}));
   rig?.mixer?.stopAllAction();
   for(const p of this.welcomePose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}
   actor.updateMatrixWorld(true);
   const bones=rig?.bones;
   this.head=bones?.mixamorigHead||null;this.headRotation=this.head?.rotation.clone();
   this.arms=['mixamorigLeftArm','mixamorigRightArm'].map(key=>bones?.[key]).filter(Boolean).map(bone=>({bone,rotation:bone.rotation.clone()}));
   // Compute bounds once. The animation loop only moves the camera and head.
   const box=new THREE.Box3().setFromObject(actor,true),size=box.getSize(V());
   this.height=Number.isFinite(size.y)&&size.y>.1?size.y:1.8;
   this.target=this.head?this.head.getWorldPosition(V()):actor.position.clone().add(V(0,this.height*.85,0));
   this.target.y-=this.height*.12;
   // Look from the far side of the friend so the player's body cannot block the face.
   const direction=game.actor&&game.actor!==actor?actor.position.clone().sub(game.actor.position):V(.4,0,7);direction.y=0;
   if(direction.lengthSq()<.01)direction.set(.4,0,7);direction.normalize().multiplyScalar(7);direction.y=.15;
   this.eye=this.target.clone().add(direction);
   actor.rotation.y=Math.atan2(this.eye.x-actor.position.x,this.eye.z-actor.position.z);
   for(const helper of Object.values(game.community?.actors||{}))if(helper.actor===actor)for(const key of ['can','hammer','bench'])if(helper[key])helper[key].visible=false;
   // Clear only trees on the camera-to-face ray and restore on exit.
   const ray=new THREE.Raycaster(this.eye,this.target.clone().sub(this.eye).normalize(),0,this.eye.distanceTo(this.target));
   const seen=new Set();
   for(const hit of ray.intersectObjects((game.treeBatches||[]).map(b=>b.mesh),false)){
    const key=`${hit.object.uuid}:${hit.instanceId}`;if(seen.has(key))continue;seen.add(key);
    if(hit.object.isInstancedMesh&&hit.instanceId!==undefined){const matrix=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,matrix);this.hidden.push({mesh:hit.object,index:hit.instanceId,matrix});}
   }
  }
 }
 update(dt){
  if(this.restored||typeof document!=='undefined'&&document.hidden)return;
  const g=this.g;g.path=[];g.keys.clear();
  if(this.phase==='welcome')this.time+=Math.min(.2,dt);
  if(this.actor&&!(this.phase==='chat'&&this.resident.id==='adam'&&g.livingTest?.friend?.chatOpen)){
   for(const p of this.welcomePose||[]){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}
   for(const h of this.hiddenActors)h.actor.visible=false;
   g.camera.near=.05;
   const t=this.reduced?1:smooth(this.time/1.15);
   g.overview=false;g.zoom=THREE.MathUtils.lerp(this.saved.zoom,Math.max(1.65,this.height*1.15),t);g.updateProjection();
   g.focus.copy(this.saved.focus).lerp(this.target,t);g.camera.up.set(0,1,0);g.camera.position.copy(this.saved.eye).lerp(this.eye,t);g.camera.lookAt(g.focus);
   if(this.head&&this.phase==='welcome'&&!this.reduced){this.head.rotation.copy(this.headRotation);this.head.rotation.y+=Math.sin(this.time*2.5)*.22*Math.sin(Math.min(1,this.time/WELCOME_SECONDS)*Math.PI);this.head.rotation.x-=.10*Math.sin(Math.min(1,this.time/2)*Math.PI);}
   if(this.phase==='welcome'&&!this.reduced){const surprise=Math.sin(Math.min(1,this.time/2.8)*Math.PI)*.22;for(const [i,a] of (this.arms||[]).entries()){a.bone.rotation.copy(a.rotation);a.bone.rotation.z+=(i===0?-1:1)*surprise;}}
   for(const h of this.hidden){h.mesh.setMatrixAt(h.index,this.zeroMatrix);h.mesh.instanceMatrix.needsUpdate=true;}
  }
  if(this.phase==='welcome'&&this.time>=(this.reduced?REDUCED_WELCOME_SECONDS:WELCOME_SECONDS))this.hello();
 }
 hello(){if(this.phase!=='welcome')return;this.phase='chat';this.onHello();}
 restore(){
  if(this.restored)return;this.restored=true;
  const g=this.g;Object.assign(g,{zoom:this.saved.zoom,viewYaw:this.saved.yaw,viewPitch:this.saved.pitch,overview:this.saved.overview});g.focus.copy(this.saved.focus);g.camera.near=this.saved.near;g.camera.far=this.saved.far;g.updateProjection();
  for(const h of this.hiddenActors)h.actor.visible=h.visible;
  if(this.actor)this.actor.rotation.y=this.saved.rotation;
  if(this.head)this.head.rotation.copy(this.headRotation);
  for(const p of this.savedPose||[]){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}
  for(const h of this.hidden){h.mesh.setMatrixAt(h.index,h.matrix);h.mesh.instanceMatrix.needsUpdate=true;}
  g.refreshDynamic?.();
 }
}
