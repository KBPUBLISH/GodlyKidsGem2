import {turnToward,updateLocomotion,resetAnimatedPose} from './character-motion.js';
import {createRelaxedIdle} from './character-idle.js';
import {dayPhase} from './island-clock.mjs';
import * as THREE from 'three';
import {heightAt,gameTime} from './core.mjs';
import {projectAssignments} from './construction-projects.mjs';
import {normalizeCharacterModel} from './character-model.js';
import {Nutrition} from './nutrition.js';
import {MEMBERS,communitySnapshot} from './community.mjs';
import {emitWorkSweat} from './work-sweat.js';
const V=(...p)=>new THREE.Vector3(...(p.length?p:[0,0,0]));
export class Community {
 constructor(game,models){
  this.g=game;this.idlePose=game.idlePose||createRelaxedIdle(models.eve.animations);this.actors={};this.lastStep=0;this.lastInput=Date.now();this.pendingInput=false;
  // Players World has no built-in villagers: only the story friends you drop off live here.
  if(game.playersOnly){this.hideBuiltIns();this.step({offline:true});this.activity();return;}
  for(const info of MEMBERS.filter(m=>m.id!=='adam')){
   const data=models[info.id],actor=new THREE.Group(),model=data.scene;actor.add(model);game.scene.add(actor);
   normalizeCharacterModel(model);
   const bones={},restPose=[];model.traverse(o=>{if(o.isBone){bones[o.name.replace(/[^a-zA-Z0-9]/g,'')]=o;restPose.push({bone:o,position:o.position.clone(),quaternion:o.quaternion.clone()});}if(o.isMesh){o.castShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.metalnessMap=null;m.roughness=.85;m.roughnessMap=null;m.normalScale?.setScalar(.3);}}});
   const mixer=new THREE.AnimationMixer(model),clips={};for(const original of data.animations){const clip=original.clone();for(const track of clip.tracks)if(track.name.endsWith('.position')&&/Hips/.test(track.name))for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}clips[original.name]=mixer.clipAction(clip);}
   const rig={actor,bones,scene:game.scene,world:game.world,particleGeometry:game.particleGeometry,particleMaterials:game.particleMaterials,particles:game.particles};
   for(const name of ['ik','solveChain','localPoint'])rig[name]=game[name].bind(rig);
   const helper={...info,actor,model,bones,restPose,mixer,clips,rig};helper.hammer=game.asset('tool_hammer');helper.bench=game.asset('construction_workbench');helper.hammer.visible=false;helper.bench.visible=false;game.scene.add(helper.hammer,helper.bench);
   if(info.id==='noah'){helper.fishing=new Nutrition(rig);helper.fishing.ripple.visible=false;}
   else{helper.can=game.asset('tool_watering_can');helper.can.visible=false;game.scene.add(helper.can);}
   this.actors[info.id]=helper;
  }
  const info=MEMBERS.find(m=>m.id==='adam'),rig={actor:game.actor,bones:game.bones,scene:game.scene,world:game.world,particleGeometry:game.particleGeometry,particleMaterials:game.particleMaterials,particles:game.particles};for(const name of ['ik','solveChain','localPoint'])rig[name]=game[name].bind(rig);
  this.actors.adam={...info,actor:game.actor,model:game.model,bones:game.bones,restPose:game.restPose,mixer:game.mixer,clips:game.clips,rig,hammer:game.asset('tool_hammer'),bench:game.asset('construction_workbench'),can:game.asset('tool_watering_can')};for(const key of ['hammer','bench','can']){this.actors.adam[key].visible=false;game.scene.add(this.actors.adam[key]);}
  if(game.actor){this.selectionRing=new THREE.Mesh(new THREE.RingGeometry(.49,.56,40),new THREE.MeshBasicMaterial({color:'#fff2a4',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));this.selectionRing.rotation.x=-Math.PI/2;game.scene.add(this.selectionRing);} 
  // Catch-up is calculated once on return, before new input starts the idle timer.
  this.step({offline:true});this.bindActive(game.store.state.activeCharacter);this.activity();
  if(game.playersOnly)this.hideBuiltIns();
 }
 /** Players World: hidden villagers must not hold homes or chores (they would block the tent for the friends you can see). */
 clearBuiltInJobs(){
  const g=this.g,s=g.store.state,c=s.community;if(!c||g.store.locked)return;
  const busy=Object.entries(c.members).filter(([,m])=>m.job);if(!busy.length)return;
  const members={...c.members};for(const [id,m] of busy)members[id]={...m,job:null,status:'Taking a break'};
  try{g.store.save({...s,community:{...c,members}});}catch(e){}
 }
 hideBuiltIns(){
  for(const member of Object.values(this.actors))if(member.actor)member.actor.visible=false;
  // The default Adam body stays hidden until a story friend takes over the controls.
  const g=this.g;if(g.playersOnly&&g.actor&&!g.actor.userData?.residentId)g.actor.visible=false;
  if(this.selectionRing)this.selectionRing.visible=false;
 }
 bindActive(id){
  const h=this.actors[id],g=this.g;
  // Players World keeps the dropped story character as the body that walks and works.
  if(g.playersOnly){this.activeId=id;this.hideBuiltIns();return;}
  if(!h?.actor)return;
  for(const member of Object.values(this.actors)){member.mixer?.stopAllAction();for(const key of ['hammer','bench','can'])if(member[key])member[key].visible=false;member.fishing?.clear();}
  for(const key of ['actor','model','bones','restPose','mixer','clips'])g[key]=h[key];g.currentClip=null;g.locomotion=null;g.walkSpeed=0;h.clip=null;h.locomotion=null;g.actor.visible=!g.playersOnly&&!g.store.state.characters[id]?.sleep;this.adamBuilder=h;this.activeId=id;this.hidAdam=false;if(g.playersOnly)this.hideBuiltIns();
 }
 activity(){if(this.g.store.state.night)return;this.lastInput=Date.now();this.pendingInput=true;this.focusUntil=0;this.g.projectAdamWalking=false;if(this.hidAdam&&!this.g.nutrition?.sleep&&!this.g.playersOnly){this.g.actor.visible=true;this.hidAdam=false;}}
 step(options={}){
  const g=this.g;if(g.store.locked)return;
  // Players World: the hidden built-in villagers never do chores; the story friends you see do the helping.
  try{const before=JSON.stringify(g.store.state.cells);g.store.communityStep(g.playersOnly?{...options,active:true,reservedMembers:Object.keys(g.store.state.community?.members||{})}:options);if(g.playersOnly)this.clearBuiltInJobs();g.syncNight?.();if(JSON.stringify(g.store.state.cells)!==before)g.refreshDynamic();if(options.offline)g.player={...g.store.state.player};this.error=null;}
  catch(e){if(this.error!==e.message){this.error=e.message;g.toast(e.message);}}
 }
 update(dt,now=Date.now()){
  const g=this.g;if(this.activeId!==g.store.state.activeCharacter)Community.prototype.bindActive.call(this,g.store.state.activeCharacter);if(g.store.state.clock.paused)dt=0;if(now-this.lastStep>=1000||(g.store.state.clock.cycle===1&&dayPhase(g.store.state.clock,now).night!==!!g.store.state.night)){this.lastStep=now;const busy=!!g.action||!!g.order||!!g.path.length||!!g.keys.size||!!g.building.preview,active=now-this.lastInput<30000||busy;
   this.step({active,activity:this.pendingInput||busy,background:typeof document!=='undefined'&&document.hidden});this.pendingInput=false;
  }
  if(g.store.state.night||g.playersOnly){for(const h of Object.values(this.actors)){if(h.actor)h.actor.visible=false;for(const key of ['hammer','bench','can'])if(h[key])h[key].visible=false;h.fishing?.clear();}if(this.selectionRing)this.selectionRing.visible=false;return;}
  const snapshot=Community.prototype.snapshot.call(this,now);if(!snapshot)return;
  for(const m of snapshot.members){
   const h=this.actors[m.id],j=m.job;if(!h?.actor||m.selected)continue;h.actor.visible=!m.resting;h.actor.position.set(m.position.x,heightAt(g.world,m.position.x,m.position.y)+.015,-m.position.y);h.fishing?.clear();if(h.can)h.can.visible=false;if(h.hammer)h.hammer.visible=false;if(h.bench)h.bench.visible=false;
   if(m.walking){
    const ahead=(m.project?projectAssignments(g.store.state,now+250).find(x=>x.id===m.id):communitySnapshot(g.store.state,gameTime(g.store.state,now+250)).members.find(x=>x.id===m.id))?.position||m.position;
    const dx=ahead.x-m.position.x,dy=ahead.y-m.position.y,speed=Math.hypot(dx,dy)/.25;
    if(speed>.001)turnToward(h.actor,Math.atan2(dx,-dy),dt);
    updateLocomotion(h,this.idlePose,dt,speed,now/1000);
   }else{
    if(!j||j.kind==='roam')updateLocomotion(h,this.idlePose,dt,0,now/1000);
    else{resetAnimatedPose(h);h.actor.updateMatrixWorld(true);h.rig.ik('Right',h.rig.localPoint([-.32,1.02,.12]));h.rig.ik('Left',h.rig.localPoint([.32,1.02,.12]));}
    if(j&&!m.resting&&j.kind!=='roam'){h.actor.rotation.y=Math.atan2(j.target.x-m.position.x,-j.target.y+m.position.y);const t=(gameTime(g.store.state,now)-j.arrive)/2.4;
     if(j.kind==='build'){Community.prototype.animateBuilder.call(this,h,now);}
     else if(j.kind==='fish'){h.fishing.rod.visible=true;h.fishing.line.visible=true;h.fishing.bobber.visible=true;h.fishing.animateFishing({t:Math.min(4.77,t/6*4.8),splashed:true});}
     else{
      const wave=Math.sin(t*3);h.bones.mixamorigSpine?.rotateX(.16+.06*wave);h.actor.updateMatrixWorld(true);h.rig.ik('Right',h.rig.localPoint([-.22,j.kind==='harvest'?.64+.08*wave:1.05,.48]));
      if(j.kind==='water'&&h.can){const hand=h.bones.mixamorigRightHand;h.can.visible=true;h.can.position.copy(hand.localToWorld(V(0,.06,0)));h.can.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()));h.can.rotateZ(-.5);}
     }
    }
   }
  }
  Community.prototype.updateAdam.call(this,now);if(this.selectionRing&&g.actor){this.selectionRing.visible=!g.playersOnly&&g.actor.visible&&!g.mapOnly;this.selectionRing.position.copy(g.actor.position);this.selectionRing.position.y+=.025;}
  if(g.playersOnly)this.hideBuiltIns();
 }
 animateBuilder(h,now){
  const phase=(now%820)/820,{wrist,head}=this.g.building.targets(phase),rig=h.rig;
  h.bones.mixamorigSpine?.rotateX(.12);h.actor.updateMatrixWorld(true);rig.ik('Right',rig.localPoint(wrist));rig.ik('Left',rig.localPoint([.3,.98,.66]));h.actor.updateMatrixWorld(true);
  const grip=h.bones.mixamorigRightHand.localToWorld(V(0,.065,0)),contact=h.hammer.userData.contact_local||[.3,.7,0],local=V(contact[0],contact[2],-contact[1]),target=rig.localPoint(head);h.toolScale??=THREE.MathUtils.clamp(grip.distanceTo(target)/Math.max(.01,local.length()),.45,1.5);
  h.hammer.visible=true;h.hammer.scale.setScalar(h.toolScale);h.hammer.position.copy(grip);h.hammer.quaternion.setFromUnitVectors(local.normalize(),target.sub(grip).normalize());h.bench.visible=true;h.bench.position.copy(rig.localPoint([0,0,.8]));h.bench.quaternion.copy(h.actor.quaternion);
  // Same working effects the hero gets: sweat beads off the brow, and a puff of wood chips when the hammer lands.
  if(h.actor.visible&&!this.g.overview){emitWorkSweat(this.g,h,h.bones,performance.now());const swing=Math.floor(now/820);if(phase>=.64&&h.hammerSwing!==swing){h.hammerSwing=swing;this.g.burst({x:h.bench.position.x,y:-h.bench.position.z},'wood',.88);}}
 }
 updateAdam(now){
  const g=this.g,a=projectAssignments(g.store.state,now).find(m=>m.id===g.store.state.activeCharacter),free=now-this.lastInput>=30000&&!g.action&&!g.order&&!g.path.length&&!g.keys.size&&!g.building.preview,h=this.adamBuilder;
  if(!h)return;h.hammer.visible=false;h.bench.visible=false;g.projectAdamWalking=false;
  if(a&&free){g.player={...a.position};g.actor.position.set(a.position.x,heightAt(g.world,a.position.x,a.position.y)+.015,-a.position.y);g.actor.visible=!a.resting;this.hidAdam=a.resting;
   if(a.walking){const ahead=projectAssignments(g.store.state,now+250).find(m=>m.id===a.id).position;turnToward(g.actor,Math.atan2(ahead.x-a.position.x,-ahead.y+a.position.y),1/60);g.projectAdamWalking=true;}
   else if(a.working){g.actor.rotation.y=Math.atan2(a.job.target.x-a.position.x,-a.job.target.y+a.position.y);this.animateBuilder(h,now);}
  }else if(this.hidAdam&&!g.nutrition?.sleep){g.actor.visible=true;this.hidAdam=false;}
 }

 settings(changes){try{this.g.store.communitySettings(changes);this.activity();this.g.notify();}catch(e){this.g.toast(e.message);}}
 find(id){const h=this.actors[id];if(!h)return;this.focusId=id;this.focusPoint=null;this.focusUntil=Number.MAX_SAFE_INTEGER;this.g.overview=false;this.g.zoom=12;this.g.resize();this.g.revealCharacterVitals(Date.now(),id);this.g.notify();}
 focusActor(){return Date.now()<this.focusUntil?(this.focusPoint?{position:this.focusPoint}:this.actors[this.focusId]?.actor):null;}
 snapshot(now=Date.now()){const state=this.g.store.state,base=communitySnapshot(state,gameTime(state,now));if(!base)return null;const assigned=projectAssignments(state,now);return {...base,members:base.members.map(m=>{if(state.night)return {...m,status:'Sleeping for the night',resting:true,walking:false,job:null};return m;}).map(m=>{const p=state.night?null:assigned.find(p=>p.id===m.id);return p?{...m,...p,selected:m.selected,role:'Builder',...(m.selected&&now-this.lastInput<30000?{position:{...state.player},resting:false,walking:false,status:'Playing with you'}:{})}:m;})};}
}
