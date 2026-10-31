import * as THREE from 'three';
import {marketTrade} from './living-market-rules.mjs';
import {gardenFresh} from './living-garden-rules.mjs';
import {heightAt} from './core.mjs';
import {scopeKey} from './storage-scope.mjs';
import {farmFresh,farmRestore,farmOffer,farmBuy,farmAdvance,farmCollect,farmUse,farmPurchaseError,FARM_PRICES} from './living-farm-rules.mjs';
const KEY=scopeKey('gk_living_farm_v1');

export class LivingFarm{
 constructor(test){
  this.test=test;this.g=test.g;
  try{
   const saved=this.g.store.state.livingFarm||JSON.parse(localStorage.getItem(KEY));this.initialState=farmRestore(saved);
   // Existing adventures keep their animals, balance, and task position.
   if(!saved?.garden&&(this.initialState.animals.length||test.state.gathered.length||this.g.store.state.livingGardenLayout==='existing'))this.initialState.garden={...gardenFresh(),approved:true,dug:3,planted:3,dugSpots:[3,4,5],plantedSpots:[3,4,5],completed:true};
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
 use(item,action){if(this.commit(farmUse(this.state,item,action))){this.test.activity();if(action==='eat')this.test.celebrate('Yum!');else this.g.toast(`+${FARM_PRICES[item]} coins`);}}
 walkTo(id){const i=this.state.animals.findIndex(a=>a.id===id);if(i>=0)this.test.walk(this.ground(i));}
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
   }prop.visible=a.ready>0;
  }
  if(this.coopLevel!==this.state.coop){this.coopLevel=this.state.coop;if(this.coop)this.group.remove(this.coop);this.coop=this.coopModel(this.state.coop);const p=this.test.layout.farmPad;this.coop.position.set(p.x,heightAt(g.world,p.x,p.y),-p.y);this.group.add(this.coop);}
 }
 coopModel(level){
  const group=new THREE.Group();if(!level)return group;
  const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.9});const wood=mat('#bd915c'),roof=mat('#a55038'),dark=mat('#554433');
  const box=(w,h,d,m,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.castShadow=true;group.add(b);return b;};
  const w=level===1?1.25:1.85;
  for(const x of [-w/2+.1,w/2-.1])for(const z of [-.35,.35])box(.1,.5,.1,dark,x,.25,z);
  box(w,.65,.85,wood,0,.7,0);box(.36,.39,.025,dark,0,.59,.44);
  for(const sign of [-1,1]){const r=box(w+.2,.09,.63,roof,0,1.12,sign*.23);r.rotation.x=sign*.4;}
  for(let i=0;i<3;i++)box(.4,.08,.18,wood,0,.12+i*.10,.95-i*.17);
  return group;
 }
 update(){
  const now=Date.now();if(now<this.checkAt)return;this.checkAt=now+500;
  const next=farmAdvance(this.state,now),newlyReady=next.animals.find((a,i)=>a.ready>0&&!this.state.animals[i].ready);
  if(this.commit(next)&&newlyReady)this.g.toast(`${newlyReady.name}: ${newlyReady.kind==='chicken'?'egg':'milk'} ready!`);
  if(this.test.watching||this.test.dialogOpen)return;
  for(const [i,a] of this.state.animals.entries()){
   const p=this.ground(i);if(a.ready&&Math.hypot(this.g.player.x-p.x,this.g.player.y-p.y)<1.15){
    const amount=a.ready;if(this.commit(farmCollect(this.state,a.id,now))){this.test.pickupNotice={label:`+${amount} ${a.kind==='chicken'?'egg'+(amount>1?'s':''):'milk'}`,until:this.test.elapsed+2};}
   }
  }
 }
 snapshot(){
  return {...this.state,pending:this.pending,error:this.error,animals:this.state.animals.map((a,i)=>({...a,screen:this.test.project(this.ground(i),.7),seconds:Math.max(0,Math.ceil((a.nextAt-Date.now())/1000))})),offers:['chicken','coop','cow'].map(kind=>({kind,...farmOffer(this.state,kind)}))};
 }
 dispose(){this.g.scene.remove(this.group);this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
}
