import * as THREE from 'three';
import { heightAt, gameTime, initialState } from './core.mjs';
import { footprint,buildingById } from './building.mjs';
import { scopeKey } from './storage-scope.mjs';
import { livingTestLayout } from './living-test-layout.mjs';
import {advancePath,turnToward,updateLocomotion,resetAnimatedPose} from './character-motion.js';
import { freshState, restoreState, currentRequest, readyToDeliver, collect, deliver,activeResourceIds, guidance } from './living-test-rules.mjs';
import {FIRST_FRIEND_BASE,readFirstFriend,offerFirstFriend} from './living-first-friend.mjs';

import {createLivingPlayer} from './living-player-model.js';
import {foodProp} from './dining.js';

const KEY=scopeKey('gk_living_island_requests_v2');
const FRIEND_KEY=scopeKey(FIRST_FRIEND_BASE);
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** Opt-in behavior on the original island. No replacement terrain, camera, scenery or UI theme. */
export class LivingIslandTest {
  constructor(game){
    this.g=game;this.elapsed=0;this.pickAt=0;this.depositAt=0;
    try{this.state=restoreState(JSON.parse(localStorage.getItem(KEY)));}catch{this.state=freshState();}
    this.openingStory=false;this.storyError='';this.celebration=null;this.pickupNotice=null;this.inviteAfter=0;
    this.onStoryMessage=event=>{
      if(event.origin!==location.origin||event.source!==window.parent)return;
      if(event.data?.type==='gk-living-first-friend-error'){this.openingStory=false;this.storyError='The story isn’t ready just yet. Please try again.';game.notify();}
    };
    window.addEventListener('message',this.onStoryMessage);
    // A stable map start makes supply locations independent of the saved player position.
    const seed=initialState(game.world);
    this.layout=livingTestLayout(game.world,seed);
    this.group=new THREE.Group();game.scene.add(this.group);this.resources=[];
    for(const p of this.layout.points){
      const object=game.asset(p.type==='wood'?'wood_pickup':p.type==='carrot'?'crop_carrot_ready':'crop_sunflower_ready');
      object.position.set(p.x,heightAt(game.world,p.x,p.y)+.04,-p.y);
      this.group.add(object);this.resources.push({...p,object});
    }
    const site=this.layout.home;
    this.foundation=game.asset('building_hut_foundation');
    const fp=footprint(game.world,site.plan);
    this.homeCenter=fp.center;
    this.foundation.position.set(fp.center.x,site.baseHeight,-fp.center.y);this.group.add(this.foundation);
    this.frame=game.asset('building_hut_frame');this.frame.position.copy(this.foundation.position);this.group.add(this.frame);
    this.flowers=new THREE.Group();this.group.add(this.flowers);
    for(const dx of [-1,0,1]){const flower=game.asset('crop_sunflower_ready');flower.position.set(fp.center.x+dx,site.baseHeight, -fp.center.y+.3);this.flowers.add(flower);}
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.82,1,48),new THREE.MeshBasicMaterial({color:'#ffe34f',side:THREE.DoubleSide,depthWrite:false}));
    this.ring.rotation.x=-Math.PI/2;this.group.add(this.ring);
    this.makePlayer();this.cargo=new THREE.Group();game.actor.add(this.cargo);this.cargo.position.set(0,1.05,-.25);this.slots=[];
    for(let i=0;i<4;i++){
      const slot=new THREE.Group();slot.position.set(0,i*.18,0);this.cargo.add(slot);
      const types={};for(const [type,asset] of [['wood','wood_pickup'],['carrot','crop_carrot_ready'],['flower','crop_sunflower_ready']]){const object=game.asset(asset);object.scale.setScalar(type==='wood'?.25:.22);slot.add(object);types[type]=object;}
      this.slots.push({slot,types});
    }
    this.picnic=new THREE.Group();this.group.add(this.picnic);
    const spot=this.layout.camp.pad;
    this.picnic.position.set(spot.x+.7,heightAt(game.world,spot.x+.7,spot.y)+.04,-spot.y);
    const mat=new THREE.Mesh(new THREE.BoxGeometry(.85,.025,.6),new THREE.MeshStandardMaterial({color:'#e2bd78',roughness:1}));this.picnic.add(mat);
    for(const x of [-.2,.2]){const plate=foodProp('carrot');plate.position.set(x,.02,0);this.picnic.add(plate);}
    this.sync();this.syncFirstFriend();
    game.status='Tap land to walk. Nearby supplies collect automatically.';
    game.zoom=13;game.focus.copy(game.actor.position);game.resize();
  }
  makePlayer(){
    const g=this.g,actor=new THREE.Group();this.playerVisual=createLivingPlayer();const body=this.playerVisual.model;actor.add(body);
    this.body=body;actor.userData={id:'you',name:'You'};
    actor.position.copy(g.actor.position);g.scene.add(actor);
    // The old Adam model stays in the original community and becomes autonomous too.
    g.actor=actor;g.model=body;g.bones={};g.restPose=[];g.mixer=new THREE.AnimationMixer(body);g.clips={};g.currentClip=null;g.locomotion=null;
    g.community.activeId='you';g.community.adamBuilder=null;
    const s=g.store.state;
    const minutes=gameTime(s),community=!s.characters.you?{...s.community,cursor:minutes,lastInput:minutes-72,members:Object.fromEntries(Object.entries(s.community.members).map(([id,m])=>[id,{...m,job:null,readyAt:minutes}]))}:s.community;
    g.store.save({...s,community,activeCharacter:'you',characters:{...s.characters,you:{name:'You',energy:100,hunger:100,hungerAt:minutes}}});
    g.community.step({active:false,activity:false});
  }
  save(){try{localStorage.setItem(KEY,JSON.stringify(this.state));}catch{this.g.toast('This test can play, but progress could not be saved.');}}
  site(){const task=currentRequest(this.state);return !task?null:this.state.stage<2?this.layout.camp.pad:this.layout.home.pad;}
  reservedFriends(){return Object.keys(this.g.community.actors).filter(id=>!this.state.adamUnlocked||id!=='adam'||this.builder?.id===id);}
  syncFirstFriend(){
    const receipt=readFirstFriend(localStorage,FRIEND_KEY);
    this.state.adamUnlocked=this.state.stage>=1&&receipt?.phase==='unlocked';
    if(this.state.adamUnlocked&&!this.state.adamArrived){
      const g=this.g,s=g.store.state,position=g.nav.nearest({x:g.player.x+1.5,y:g.player.y+1},4)||s.community.members.adam.position;
      g.store.save({...s,community:{...s.community,members:{...s.community.members,adam:{...s.community.members.adam,position,job:null,readyAt:gameTime(s)}}}});
      this.state.adamArrived=true;this.save();
    }
    this.applyFriendVisibility();
    this.sync();
  }
  applyFriendVisibility(){
    for(const [id,h] of Object.entries(this.g.community.actors)){
      const visible=this.state.adamUnlocked&&id==='adam';h.actor.visible=visible;
      if(!visible){for(const key of ['hammer','bench','can'])if(h[key])h[key].visible=false;h.fishing?.clear();}
    }
  }
  requestFirstFriend(){
    if(this.state.stage<1||this.state.adamUnlocked||this.openingStory)return;
    this.storyError='';
    if(window.parent===window){this.storyError='Open your island in the app to read Adam’s story.';this.g.notify();return;}
    this.openingStory=true;window.parent.postMessage({type:'gk-living-collect-first-friend'},location.origin);this.g.notify();
  }
  dismissInvite(){this.state.inviteDismissed=true;this.save();this.g.notify();}
  openInvite(){if(this.state.stage>=1&&!this.state.adamUnlocked){this.state.inviteDismissed=false;this.g.notify();}}
  welcomeAdam(){this.state.welcomeSeen=true;this.save();this.g.notify();}
  walk(point){if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;this.g.tool='walk';this.g.walk(point);this.g.renderer.domElement.focus({preventScroll:true});}
  nextTarget(){
    const hint=guidance(this.state);if(!hint)return null;
    if(hint.delivery)return this.site();
    return this.resources.filter(r=>r.object.visible).sort((a,b)=>Math.hypot(this.g.player.x-a.x,this.g.player.y-a.y)-Math.hypot(this.g.player.x-b.x,this.g.player.y-b.y))[0]||null;
  }
  showNext(){this.walk(this.nextTarget());}
  hearTask(){
    const hint=guidance(this.state);if(!hint||!window.speechSynthesis)return;
    window.speechSynthesis.cancel();const words=new SpeechSynthesisUtterance(`${hint.instruction} ${hint.progress}.`);words.rate=.85;window.speechSynthesis.speak(words);
  }
  celebrate(title){this.celebration={title,until:this.elapsed+3.2};this.g.burst(this.g.player,'seed',.8);}
  visitHome(){if(this.state.homeWork===1)this.g.building.enterHome('living-test-home');}
  hello(id){if(!this.state.adamUnlocked||id!=='adam')return;const task=currentRequest(this.state);this.g.toast(task?.friend===id?`Adam: ${task.ask}`:'Adam: It’s good to share this island with you.');}
  click(ray){
    const meshes=[...Object.values(this.g.community.actors).filter(h=>h.actor.visible).map(h=>h.actor),...this.resources.filter(r=>r.object.visible).map(r=>r.object)];
    const hit=ray.intersectObjects(meshes,true)[0];
    if(hit){
      for(const [id,friend] of Object.entries(this.g.community.actors)){
        let node=hit.object;while(node&&node!==friend.actor)node=node.parent;
        if(node===friend.actor){this.hello(id);return;}
      }
      for(const r of this.resources){let node=hit.object;while(node&&node!==r.object)node=node.parent;if(node===r.object){this.walk(r);return;}}
    }
    const point=new THREE.Vector3();if(ray.ray.intersectPlane(this.g.groundPlane,point)){
      const target=this.g.nav.nearest({x:point.x,y:-point.z},2);if(target)this.walk(target);
    }
  }
  sync(){
    const g=this.g,task=currentRequest(this.state),site=this.site(),active=activeResourceIds(this.state);
    for(const r of this.resources)r.object.visible=!this.state.gathered.includes(r.id)&&active.includes(r.id);
    const carried=Object.entries(this.state.inventory).flatMap(([type,n])=>Array(n).fill(type));
    this.slots.forEach(({slot,types},i)=>{slot.visible=i<carried.length;for(const [type,obj] of Object.entries(types))obj.visible=carried[i]===type;});
    this.picnic.visible=this.state.stage>=2;
    this.foundation.visible=this.state.adamUnlocked&&this.state.stage>=2&&this.state.homeWork<.25;this.frame.visible=this.state.homeWork>=.25&&this.state.homeWork<1;this.flowers.visible=this.state.homeWork>=1;
    this.ring.visible=!!site;if(site)this.ring.position.set(site.x,heightAt(g.world,site.x,site.y)+.05,-site.y);
    // Reward uses the real, furnished hut and the original building/navigation systems.
    let s=g.store.state;
    if(this.state.stage>=1&&!s.buildings.some(b=>b.id==='living-test-camp')){
      const def=buildingById('campfire'),paidMaterials={};if(def.wood)paidMaterials.pine_wood=def.wood;if(def.stone)paidMaterials.stone=def.stone;
      const b={...this.layout.camp.plan,id:'living-test-camp',status:'complete',baseHeight:this.layout.camp.baseHeight,startedAt:Date.now()-10000,paidMaterials,litAt:gameTime(s),fuelUntil:gameTime(s)+360};
      g.store.save({...s,buildings:[...s.buildings,b]});g.refreshDynamic();s=g.store.state;
    }
    if(this.state.homeWork>=1&&!s.buildings.some(b=>b.id==='living-test-home')){
      const b={...this.layout.home.plan,id:'living-test-home',status:'complete',baseHeight:this.layout.home.baseHeight,startedAt:Date.now()-18000,paidMaterials:{pine_wood:10,stone:5}};
      g.store.save({...s,buildings:[...s.buildings,b]});g.refreshDynamic();
    }
  }
  update(dt,speed){
    this.elapsed+=dt;const g=this.g;
    this.applyFriendVisibility();
    this.playerVisual.update(dt,speed,this.elapsed,{celebrating:this.celebration?.until>this.elapsed,carrying:Object.values(this.state.inventory).some(n=>n>0)});
    if(this.celebration&&this.elapsed>=this.celebration.until){this.celebration=null;g.notify();}
    if(this.state.adamUnlocked&&this.state.stage>=3&&this.state.homeWork<1){
      const helper=g.community.actors.adam;
      if(!this.builder){
        const position={x:helper.actor.position.x,y:-helper.actor.position.z};
        this.builder={id:'adam',position,path:g.nav.path(position,this.layout.home.pad)||[]};
        const s=g.store.state,m=s.community.members.adam;
        g.store.save({...s,community:{...s.community,members:{...s.community.members,adam:{...m,position,job:null,readyAt:gameTime(s)}}}});
      }
      helper.fishing?.clear();const b=this.builder,before={...b.position};advancePath(b.position,b.path,dt*1.5);
      helper.actor.position.set(b.position.x,heightAt(g.world,b.position.x,b.position.y)+.015,-b.position.y);
      if(b.path.length){turnToward(helper.actor,Math.atan2(b.position.x-before.x,-b.position.y+before.y),dt);updateLocomotion(helper,g.idlePose,dt,1.5,Date.now()/1000);}
      else{
        resetAnimatedPose(helper);helper.actor.rotation.y=Math.atan2(this.homeCenter.x-b.position.x,b.position.y-this.homeCenter.y);g.community.animateBuilder(helper,Date.now());
        const previous=this.state.homeWork;this.state.homeWork=Math.min(1,this.state.homeWork+dt/18);
        if(previous<.25&&this.state.homeWork>=.25)this.sync();
        if(this.state.homeWork===1){
          const s=g.store.state,m=s.community.members.adam;
          g.store.save({...s,community:{...s.community,members:{...s.community.members,adam:{...m,position:{...b.position},job:null,readyAt:gameTime(s)}}}});
          this.builder=null;this.save();this.sync();this.celebrate('Your home is ready!');g.toast('Adam: Come and see our new home!');
        }
      }
    }
    const task=currentRequest(this.state);if(!task)return;
    if(this.elapsed>=this.pickAt){
      const found=this.resources.filter(r=>r.object.visible&&Math.hypot(g.player.x-r.x,g.player.y-r.y)<1.05).sort((a,b)=>Math.hypot(g.player.x-a.x,g.player.y-a.y)-Math.hypot(g.player.x-b.x,g.player.y-b.y))[0];
      if(found){const next=collect(this.state,found.id);if(next!==this.state){this.state=next;this.pickAt=this.elapsed+.3;this.pickupNotice={label:found.type==='wood'?'+1 log':'+1 carrot',until:this.elapsed+1.5};this.save();this.sync();g.burst(found,found.type==='wood'?'wood':'seed',.3);g.notify();}}
    }
    const site=this.site();
    if(site&&readyToDeliver(this.state)&&this.elapsed>=this.depositAt&&Math.hypot(g.player.x-site.x,g.player.y-site.y)<1.05){
      const before=this.state.stage,next=deliver(this.state,task.friend);
      if(next!==this.state){this.state=next;this.depositAt=this.elapsed+.35;if(next.stage===1)offerFirstFriend(localStorage,FRIEND_KEY);this.save();this.sync();if(next.stage!==before){this.celebrate(before===0?'You made your first camp!':before===1?'A picnic to share!':'Adam is building your home!');if(before===0)this.inviteAfter=this.elapsed+3.2;g.toast(task.friend==='you'?task.thanks:`${task.name}: ${task.thanks}`,4500);}g.notify();}
    }
  }
  project(point,above=.7){
    const r=this.g.renderer.domElement.getBoundingClientRect();
    const p=V(point.x,heightAt(this.g.world,point.x,point.y)+above,-point.y).project(this.g.camera);
    return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.85};
  }
  snapshot(){
    const task=currentRequest(this.state),site=this.site();
    const target=this.nextTarget();
    return {task,guidance:guidance(this.state),target:target?{...this.project(target,.85),id:target.id||'delivery'}:null,celebration:this.celebration?.until>this.elapsed?this.celebration.title:null,pickupNotice:this.pickupNotice?.until>this.elapsed?this.pickupNotice.label:null,canSpeak:typeof window.speechSynthesis!=='undefined',insideHome:!!this.g.interior,stage:this.state.stage,deposited:task?this.state.deposits[task.id]:0,inventory:this.state.inventory,homeReady:this.state.homeWork===1,
      adamUnlocked:this.state.adamUnlocked,inviteVisible:this.state.stage>=1&&!this.state.adamUnlocked&&!this.state.inviteDismissed&&this.elapsed>=this.inviteAfter,welcomeVisible:this.state.adamUnlocked&&!this.state.welcomeSeen,
      openingStory:this.openingStory,storyError:this.storyError,
      site:site?this.project(site,1.3):null,
      resources:this.resources.filter(r=>r.object.visible).map(r=>({id:r.id,type:r.type,...this.project(r)})),
      friends:this.state.adamUnlocked?[{id:'adam',name:'Adam'}]:[]};
  }
  dispose(){window.speechSynthesis?.cancel();window.removeEventListener('message',this.onStoryMessage);}
}
