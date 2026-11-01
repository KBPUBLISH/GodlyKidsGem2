import {createCoopModel} from './coop-model.js';
import {coopPlacementStatus} from './coop-placement.mjs';
import {coopSurfaceHeight,eggSlots} from './coop-layout.mjs';
import * as THREE from 'three';
import {marketTrade} from './living-market-rules.mjs';
import {CARROT_SPOTS,PICK_CROPS} from './living-garden-rules.mjs';
import {heightAt} from './core.mjs';
import {scopeKey} from './storage-scope.mjs';
import {farmFresh,farmRestore,farmOffer,farmBuy,farmAdvance,farmCollect,farmUse,farmCollectEgg,farmPurchaseError,FARM_PRICES} from './living-farm-rules.mjs';
const KEY=scopeKey('gk_living_farm_v1');

export class LivingFarm{
 constructor(test){
  this.test=test;this.g=test.g;
  try{
   const saved=this.g.store.state.livingFarm||JSON.parse(localStorage.getItem(KEY));this.initialState=farmRestore(saved);
   // The earlier introduction ended at the tent. Keep those earned goals complete.
   if(![2,3].includes(saved?.garden?.version)&&(test.state.stage>=1||!saved?.garden&&(this.initialState.animals.length||test.state.gathered.length||this.g.store.state.livingGardenLayout==='existing'))){
    this.initialState.garden={...this.initialState.garden,planted:4,plantedSpots:[...CARROT_SPOTS],rewarded:true,picked:Object.fromEntries(PICK_CROPS.map(c=>[c,1])),completed:true,readyAt:this.initialState.garden.readyAt};
   }
  }catch{this.initialState=farmFresh();}
  this.pending=null;this.error='';if(JSON.stringify(this.g.store.state.livingFarm)!==JSON.stringify(this.initialState)){try{this.g.store.save({...this.g.store.state,livingFarm:this.initialState});}catch{this.error='We couldn’t save that. Please try again.';}}this.checkAt=0;this.group=new THREE.Group();this.g.scene.add(this.group);this.produce=new Map();this.sync();
 }
 get state(){return this.g.store.state.livingFarm||this.initialState;}
 trade(kind,id){const next=marketTrade(this.state,this.g.store.state.inventory,kind,id);if(!next)return false;return this.commit(next.farm,{inventory:next.inventory});}
 commit(next,changes={}){
  if(next===this.state)return false;
  try{this.g.store.save({...this.g.store.state,...changes,livingFarm:next});}catch{this.error='We couldn’t save that. Please try again.';this.g.notify();return false;}
  this.error='';this.sync();this.test.garden?.sync();this.test.sync();this.g.notify();return true;
 }
 offer(kind){this.test.activity();this.pending={kind,...farmOffer(this.state,kind)};this.error='';this.g.notify();}
 dismissChicken(){this.commit({...this.state,chickenDismissed:true});}
 cancel(){if(this.pending?.kind==='chicken'&&!this.state.animals.length)this.dismissChicken();this.pending=null;this.error='';this.g.notify();}
 confirm(name){
  const pending=this.pending;if(!pending)return false;
  const next=farmBuy(this.state,pending.kind,name,Date.now());
  if(next===this.state){this.error=farmPurchaseError(this.state,pending.kind,name,Date.now())||'Please try again.';this.g.notify();return false;}
  if(!this.commit(next))return false;
  this.pending=null;this.test.celebrate(pending.kind==='coop'?'Coop ready!':`Welcome, ${next.animals.at(-1).name}!`);this.g.notify();return true;
 }
 use(item,action){if(action==='cook'&&item==='egg'){this.test.activity();this.g.nutrition.cook('fry_egg');return;}if(action==='eat'){this.test.activity();this.g.nutrition.eat(item,'farm');return;}if(this.commit(farmUse(this.state,item,action))){this.test.activity();this.g.toast(`+${FARM_PRICES[item]} coins`);}}
 openCoop(){if(!this.state.coop)return;this.g.path=[];this.g.order=null;this.g.keys.clear();this.g.marker.visible=false;window.dispatchEvent(new Event('gk-open-coop'));}
 collectEgg(id,slot){return this.commit(farmCollectEgg(this.state,id,slot,Date.now()));}
 get position(){return this.state.coopPosition||this.test.layout.farmPad;}
 surfaceHeight(x,y){return this.state.coop?coopSurfaceHeight(this.position,x,y):null;}
 offerCoop(){this.g.prompt=null;this.g.showPrompt('coop','living-coop',this.position,1.5,[{id:'coop-enter',label:'Go in',icon:'walk'},{id:'coop-move',label:'Move',icon:'build'}]);}
 startMove(){
  if(this.g.action||this.g.order){this.g.toast('Finish this action first.');return;}
  if(this.moving||!this.state.coop)return;
  this.g.prompt=null;this.moveZoom=this.g.zoom;this.g.zoom=Math.max(this.g.zoom,19);this.g.resize();this.moving=true;this.moveTarget={...this.position};this.g.keys.clear();this.g.path=[];
  this.moveGhost=this.coopModel(this.state.coop);this.group.add(this.moveGhost);
  this.moveGhost.traverse(o=>{if(o.isMesh){o.castShadow=false;o.material.transparent=true;o.material.opacity=.65;o.material.depthWrite=false;}});
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.05),new THREE.MeshBasicMaterial({transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}));pad.rotation.x=-Math.PI/2;pad.position.set(0,.025,.325);this.moveGhost.add(pad);
  this.updateMovePreview();this.g.notify();
 }
 updateMovePreview(){if(!this.moving||!this.moveGhost)return;const p=this.moveTarget;this.moveValid=coopPlacementStatus(this.g.world,this.g.store.state,p);this.moveGhost.position.set(p.x,heightAt(this.g.world,p.x,p.y),-p.y);this.moveGhost.traverse(o=>{if(o.isMesh)o.material.color.set(this.moveValid?'#48bd73':'#eb6555');});if(this.coop)this.coop.visible=false;}
 nudgeMove(dx,dy){if(!this.moving)return;this.moveTarget={x:this.moveTarget.x+dx*.5,y:this.moveTarget.y+dy*.5};this.updateMovePreview();this.g.notify();}
 confirmMove(){if(!this.moving)return false;this.updateMovePreview();if(!this.moveValid){this.g.toast('Choose a clear spot for your coop.');this.g.notify();return false;}const target={...this.moveTarget};if(!this.commit({...this.state,coopPosition:target}))return false;this.cancelMove();this.g.toast('Coop moved!');return true;}
 cancelMove(){this.moving=false;this.moveTarget=null;if(this.moveGhost){this.group.remove(this.moveGhost);this.moveGhost.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.moveGhost=null;}if(this.coop)this.coop.visible=true;if(this.moveZoom!=null){this.g.zoom=this.moveZoom;this.moveZoom=null;this.g.resize();}this.g.notify();}
 click(ray){if(this.moving){const p=new THREE.Vector3();if(ray.ray.intersectPlane(this.g.groundPlane,p)){this.moveTarget={x:p.x,y:-p.z};this.updateMovePreview();this.g.notify();}return true;}if(this.state.coop){const hit=ray.intersectObject(this.coop,true)[0];if(hit){if(hit.object.userData.coopStep)this.g.walk({x:hit.point.x,y:-hit.point.z});else this.offerCoop();return true;}}return false;}
 walkTo(id){if(this.state.animals.find(a=>a.id===id)?.kind==='chicken'){this.openCoop();return;}const i=this.state.animals.findIndex(a=>a.id===id);if(i>=0)this.test.walk(this.ground(i));}
 ground(i){return this.test.layout.farmSpots[i];}
 sync(){
  const g=this.g,s=g.store.state,owned=new Set(this.state.animals.map(a=>a.id));
  // Reconcile the durable farm receipt with the original island's animal renderer.
  const keep=(s.animals||[]).filter(a=>!a.id.startsWith('living-farm-')||owned.has(a.id));
  for(const [i,a] of this.state.animals.entries())if(!keep.some(b=>b.id===a.id)){const p=this.ground(i);keep.push({id:a.id,kind:a.kind,x:p.x,y:p.y,placedAt:Date.now(),name:a.name});}
  if(JSON.stringify(keep)!==JSON.stringify(s.animals||[])){try{g.store.save({...s,animals:keep});g.animals.sync();}catch{this.error='Your animal is coming. Please reopen the island if it takes a moment.';}}
  for(const [i,a] of this.state.animals.entries()){
   let prop=this.produce.get(a.id);
   if(!prop){prop=new THREE.Group();const p=this.ground(i);prop.position.set(p.x,heightAt(g.world,p.x,p.y)+.05,-p.y);this.group.add(prop);this.produce.set(a.id,prop);
    const straw=new THREE.Mesh(new THREE.CylinderGeometry(.33,.29,.07,18),new THREE.MeshStandardMaterial({color:'#bf984f',roughness:1}));prop.add(straw);
    const item=new THREE.Mesh(a.kind==='chicken'?new THREE.SphereGeometry(.13,14,10):new THREE.CylinderGeometry(.13,.16,.32,14),new THREE.MeshStandardMaterial({color:a.kind==='chicken'?'#fff3d6':'#ddd9c9',roughness:.8}));item.position.y=a.kind==='chicken'?.19:.21;if(a.kind==='chicken')item.scale.y=1.3;prop.add(item);
   }prop.visible=a.kind!=='chicken'&&a.ready>0;
  }
  if(this.coopLevel!==`${this.state.coop}:${this.position.x}:${this.position.y}`){this.coopLevel=`${this.state.coop}:${this.position.x}:${this.position.y}`;if(this.coop){this.group.remove(this.coop);this.coop.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}this.coop=this.coopModel(this.state.coop);const p=this.position;this.coop.position.set(p.x,heightAt(g.world,p.x,p.y),-p.y);this.group.add(this.coop);}
 }
 coopModel(level){return createCoopModel(level);}
 chickenRoutine(inst,dt){
  const a=this.state.animals.find(a=>a.id===inst.id);if(a?.kind!=='chicken'||!this.state.coop)return false;
  const p=this.position,anchor=`${p.x}:${p.y}`;if(inst.coopAnchor!==anchor){inst.coopRoost=false;inst.coopAnchor=anchor;}
  const roost=a.ready>0||a.nextAt-Date.now()<10000;
  if(!roost){if(inst.coopRoost){inst.path=null;inst.mode='idle';inst.wait=.5;inst.coopRoost=false;}return false;}
  const index=this.state.animals.filter(a=>a.kind==='chicken').findIndex(a=>a.id===inst.id),nest={x:p.x+(index%3-1)*.45,y:p.y};
  if(!inst.coopRoost){const entry={x:p.x,y:p.y-1.8},path=this.g.animals.routeTo(inst,entry);if(!path)return false;inst.path=[...path,entry,{x:p.x,y:p.y-.65},nest];inst.coopRoost=true;inst.mode='move';this.g.animals.play(inst,'move');}
  if(inst.path?.length)this.g.animals.stepMove(inst,dt);else{inst.mode='idle';this.g.animals.play(inst,'idle');}
  return true;
 }
 update(){
  const now=Date.now();if(now<this.checkAt)return;this.checkAt=now+500;if(this.moving)this.updateMovePreview();
  const next=farmAdvance(this.state,now),newlyReady=next.animals.find((a,i)=>a.ready>0&&!this.state.animals[i].ready);
  if(this.commit(next)&&newlyReady)this.g.toast(`${newlyReady.name}: ${newlyReady.kind==='chicken'?'egg':'milk'} ready!`);
  if(this.test.watching||this.test.dialogOpen)return;
  for(const [i,a] of this.state.animals.entries()){
   const p=this.ground(i);if(a.kind!=='chicken'&&a.ready&&Math.hypot(this.g.player.x-p.x,this.g.player.y-p.y)<1.15){
    const amount=a.ready;if(this.commit(farmCollect(this.state,a.id,now))){this.test.pickupNotice={label:`+${amount} ${a.kind==='chicken'?'egg'+(amount>1?'s':''):'milk'}`,until:this.test.elapsed+2};}
   }
  }
 }
 snapshot(){
  return {...this.state,moving:!!this.moving,moveValid:!!this.moveValid,coopScreen:this.test.project(this.position,1.1),eggCount:this.state.animals.filter(a=>a.kind==='chicken').reduce((n,a)=>n+a.ready,0),pending:this.pending,error:this.error,animals:this.state.animals.map((a,i)=>({...a,eggSlots:eggSlots(a),screen:this.test.project(this.ground(i),.7),seconds:Math.max(0,Math.ceil((a.nextAt-Date.now())/1000))})),offers:['chicken','coop','cow'].map(kind=>({kind,...farmOffer(this.state,kind)}))};
 }
 dispose(){this.g.scene.remove(this.group);this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
}
