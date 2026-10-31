import * as THREE from 'three';
import {heightAt,cellFromKey} from './core.mjs';
import {gardenAvailable,gardenNext,gardenWork,gardenHarvest,GARDEN_CROPS,CARROT_SPOTS,HARVEST_COINS} from './living-garden-rules.mjs';
import {FARM_ACTION_SECONDS} from './living-action-motion.mjs';

export class LivingGarden {
 constructor(test){
  this.test=test;this.g=test.g;this.work=null;this.animating=false;
  this.group=new THREE.Group();this.g.scene.add(this.group);this.plots=[];
  const slots=this.g.world.gardenSlots,cols=[...new Set(slots.map(p=>p.col))].sort((a,b)=>a-b),rows=[...new Set(slots.map(p=>p.row))].sort((a,b)=>a-b);
  for(const row of [rows[1],rows[0]])for(const col of cols.slice(0,3))this.plots.push({...cellFromKey(this.g.world,`${col}:${row}`),crop:GARDEN_CROPS[this.plots.length]});
  this.small=this.g.store.state.livingGardenLayout==='small';
  this.makeScene();this.sync();
 }
 get state(){return this.test.farm.state.garden;}
 makeScene(){
  if(!this.small)return;
  const g=this.g,add=(id,x,y,rotation=0)=>{const o=g.asset(id);o.position.set(x,heightAt(g.world,x,y)+.025,-y);o.rotation.y=rotation;this.group.add(o);return o;};
  const xs=this.plots.slice(0,3).map(p=>p.x),front=this.plots[3].y-.65,back=this.plots[0].y+.65;
  for(const x of xs){add('fence_straight',x,back);add('fieldborder_straight',x,front);}
  for(const p of [this.plots[0],this.plots[3]])add('fence_straight',xs[0]-.65,p.y,Math.PI/2);
  // The right-hand opening faces the arrival point and stays wide enough to walk through.
  add('fence_straight',xs[2]+.65,this.plots[2].y,Math.PI/2);
  for(const p of this.plots){
   p.soil=add('tile_tilled_dry',p.x,p.y);
   p.cropObject=p.crop==='lettuce'?this.lettuce():g.asset(`crop_${p.crop}_ready`);
   p.cropObject.position.set(p.x,heightAt(g.world,p.x,p.y)+.055,-p.y);this.group.add(p.cropObject);
  }
  this.highlights=[];
  for(const index of [0,1,2,3,4,5]){
   const p=this.plots[index],tile=new THREE.Group();tile.position.set(p.x,heightAt(g.world,p.x,p.y)+.065,-p.y);
   const fill=new THREE.Mesh(new THREE.PlaneGeometry(.88,.88),new THREE.MeshBasicMaterial({color:'#ffdf73',transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));fill.rotation.x=-Math.PI/2;tile.add(fill);
   const points=[[-.45,-.45],[.45,-.45],[.45,.45],[-.45,.45],[-.45,-.45]].map(([x,z])=>new THREE.Vector3(x,.01,z));
   tile.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#fff2a0'})));
   this.group.add(tile);this.highlights.push({index,tile,fill});
  }
  this.marker=new THREE.Mesh(new THREE.RingGeometry(.31,.43,32),new THREE.MeshBasicMaterial({color:'#ffe34f',side:THREE.DoubleSide,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.group.add(this.marker);
 }
 lettuce(){
  const group=new THREE.Group(),geometry=new THREE.SphereGeometry(1,12,8);
  const mats=['#81b954','#4f913b','#b7d877'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.85}));
  this.ownedGeometry=geometry;this.ownedMaterials=mats;
  for(let i=0;i<6;i++){const leaf=new THREE.Mesh(geometry,mats[i%3]);const a=i*Math.PI/3;leaf.position.set(Math.sin(a)*.16,.18,Math.cos(a)*.16);leaf.scale.set(.20,.17,.23);leaf.castShadow=true;group.add(leaf);}
  const heart=new THREE.Mesh(geometry,mats[2]);heart.position.y=.23;heart.scale.set(.23,.23,.23);group.add(heart);return group;
 }
 sync(){
  if(!this.small)return;
  const s=this.state,now=Date.now(),next=gardenNext(s);
  this.plots.forEach((p,i)=>{p.soil.visible=true;p.cropObject.visible=!CARROT_SPOTS.includes(i)||s.plantedSpots.includes(i);p.cropObject.scale.setScalar(s.readyAt[i]>now?.38:1);});
  for(const h of this.highlights){h.tile.visible=gardenAvailable(s).includes(h.index);h.fill.material.color.set(s.planted<4?'#a7ed7c':'#ffdf73');}
  this.marker.visible=false;if(next){const p=this.plots[next.index];this.marker.position.set(p.x,heightAt(this.g.world,p.x,p.y)+.06,-p.y);}
 }
 cancel(){this.test.actions.clear(this.work);this.work=null;this.animating=false;}
 go(index){
  if(!this.small||this.g.action||this.g.order||this.g.store.state.night)return;
  this.test.activity();
  const next=gardenNext(this.state),job=next?{...next,index:index??next.index}:{kind:'harvest',index:index??this.state.readyAt.findIndex(t=>t<=Date.now())};
  if(!Number.isInteger(job.index)||!this.plots[job.index]||this.work)return;
  if(job.kind!=='harvest'&&!gardenAvailable(this.state).includes(job.index))return;
  if(job.kind==='harvest'&&!this.state.completed&&!gardenAvailable(this.state).includes(job.index))return;
  if(job.kind==='harvest'&&this.state.readyAt[job.index]>Date.now()&&this.state.completed)return;
  const p=this.plots[job.index];this.test.walk(p);this.work={...job,elapsed:0};this.g.notify();
 }
 update(dt){
  this.animating=false;
  if(!this.small)return;
  const now=Date.now();if(now>(this.refreshAt||0)){this.refreshAt=now+1000;this.sync();}
  const w=this.work;if(!w)return;
  if(this.g.action||this.g.order){this.cancel();return;}
  if(this.test.watching||this.test.dialogOpen){this.test.actions.clear(w);return;}
  const p=this.plots[w.index],g=this.g;
  if(Math.hypot(g.player.x-p.x,g.player.y-p.y)>.75){if(!g.path.length){this.cancel();g.notify();}return;}
  g.path=[];if(w.kind==='harvest'&&now<this.state.readyAt[w.index])return;w.elapsed+=dt;
  this.animating=true;this.test.actions.pose(w,w.kind,w.elapsed,p);
  if(w.elapsed<FARM_ACTION_SECONDS[w.kind])return;
  this.cancel();
  const before=this.state.rewarded,s=this.test.farm.state;
  const next=w.kind==='harvest'?gardenHarvest(s,w.index,now):gardenWork(s,w.kind,w.index,now);
  if(this.test.farm.commit(next)){
   g.burst(p,'seed',.5);
   if(!before&&this.state.rewarded)this.test.celebrate('+10 coins!');
   else{this.test.pickupNotice={label:w.kind==='plant'?'Planted!':`+${HARVEST_COINS} coins`,until:this.test.elapsed+2};}
   g.notify();
  }
 }
 click(ray){
  if(!this.small)return false;
  const point=new THREE.Vector3();if(!ray.ray.intersectPlane(this.g.groundPlane,point))return false;
  const i=this.plots.findIndex(p=>Math.hypot(p.x-point.x,p.y+point.z)<.55);
  if(i<0)return false;
  if(this.state.completed)this.go(i);else if(gardenAvailable(this.state).includes(i))this.go(i);
  return true;
 }
 snapshot(){
  const s=this.state,next=gardenNext(s),target=next?this.plots[next.index]:null,planting=s.planted<4;
  const seconds=next?.kind==='harvest'?Math.max(0,Math.ceil((s.readyAt[next.index]-Date.now())/1000)):0;
  return {...s,busy:!!this.work,small:this.small,phase:planting?'plant':'harvest',seconds,
   readyCount:this.small&&s.completed?s.readyAt.filter(t=>t<=Date.now()).length:0,
   label:planting?'Plant a carrot seed':`Pick a ${target?.crop||'vegetable'}`,
   instruction:planting?'Tap a glowing spot to plant a carrot seed. Four seeds earn 10 coins!':'Pick one carrot, one pumpkin and one lettuce.',
   progress:planting?`${s.planted} / 4 carrot seeds planted`:`${Object.values(s.picked).reduce((a,b)=>a+b,0)} / 3 vegetables picked`,
   value:planting?s.planted:Object.values(s.picked).reduce((a,b)=>a+b,0),total:planting?4:3,
   spots:gardenAvailable(s).map(index=>({index,crop:this.plots[index].crop,...this.test.project(this.plots[index],.12)})),
   target:target?this.test.project(target,.1):null,
   crops:this.small?this.plots.map((p,i)=>({index:i,crop:p.crop,ready:s.planted===4&&s.readyAt[i]<=Date.now(),...this.test.project(p,.5)})):[]};
 }

 dispose(){this.g.scene.remove(this.group);this.highlights?.forEach(h=>h.tile.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}));this.marker?.geometry.dispose();this.marker?.material.dispose();this.ownedGeometry?.dispose();this.ownedMaterials?.forEach(m=>m.dispose());}
}
