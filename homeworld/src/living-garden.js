import * as THREE from 'three';
import {heightAt,cellFromKey} from './core.mjs';
import {gardenNext,gardenApprove,gardenWork,gardenHarvest,GARDEN_CROPS,HARVEST_COINS} from './living-garden-rules.mjs';

export class LivingGarden {
 constructor(test){
  this.test=test;this.g=test.g;this.pending=false;this.work=null;
  this.group=new THREE.Group();this.g.scene.add(this.group);this.plots=[];
  const slots=this.g.world.gardenSlots,cols=[...new Set(slots.map(p=>p.col))].sort((a,b)=>a-b),rows=[...new Set(slots.map(p=>p.row))].sort((a,b)=>a-b);
  for(const row of [rows[1],rows[0]])for(const col of cols.slice(0,3))this.plots.push({...cellFromKey(this.g.world,`${col}:${row}`),crop:GARDEN_CROPS[this.plots.length%3]});
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
   p.cropObject=p.crop==='cabbage'?this.cabbage():g.asset(`crop_${p.crop}_ready`);
   p.cropObject.position.set(p.x,heightAt(g.world,p.x,p.y)+.055,-p.y);this.group.add(p.cropObject);
  }
  this.marker=new THREE.Mesh(new THREE.RingGeometry(.31,.43,32),new THREE.MeshBasicMaterial({color:'#ffe34f',side:THREE.DoubleSide,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.group.add(this.marker);
  this.hoe=g.asset('tool_hoe');this.hoe.scale.setScalar(.65);this.hoe.visible=false;this.group.add(this.hoe);
 }
 cabbage(){
  const group=new THREE.Group(),geometry=new THREE.SphereGeometry(1,12,8);
  const mats=['#81b954','#4f913b','#b7d877'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.85}));
  this.ownedGeometry=geometry;this.ownedMaterials=mats;
  for(let i=0;i<6;i++){const leaf=new THREE.Mesh(geometry,mats[i%3]);const a=i*Math.PI/3;leaf.position.set(Math.sin(a)*.16,.18,Math.cos(a)*.16);leaf.scale.set(.20,.17,.23);leaf.castShadow=true;group.add(leaf);}
  const heart=new THREE.Mesh(geometry,mats[2]);heart.position.y=.23;heart.scale.set(.23,.23,.23);group.add(heart);return group;
 }
 sync(){
  if(!this.small)return;
  const s=this.state,now=Date.now(),next=gardenNext(s);
  this.plots.forEach((p,i)=>{p.soil.visible=i<3||i<3+s.dug;p.cropObject.visible=i<3||i<3+s.planted;p.cropObject.scale.setScalar(s.readyAt[i]>now?.38:1);});
  this.marker.visible=!!next;if(next){const p=this.plots[next.index];this.marker.position.set(p.x,heightAt(this.g.world,p.x,p.y)+.06,-p.y);}
 }
 approve(){if(this.test.farm.commit(gardenApprove(this.test.farm.state))){this.pending=false;this.g.notify();}else this.g.notify();}
 cancel(){this.pending=false;this.g.notify();}
 go(index){
  if(!this.small)return;
  this.test.activity();
  if(!this.state.approved){this.pending=true;this.g.notify();return;}
  const next=gardenNext(this.state),job=next||{kind:'harvest',index:index??this.state.readyAt.findIndex(t=>t<=Date.now())};
  if(!Number.isInteger(job.index)||!this.plots[job.index]||this.work)return;
  if(job.kind==='harvest'&&this.state.readyAt[job.index]>Date.now())return;
  const p=this.plots[job.index];this.test.walk(p);this.work={...job,elapsed:0};this.g.notify();
 }
 update(dt){
  if(!this.small)return;
  const now=Date.now();if(now>(this.refreshAt||0)){this.refreshAt=now+1000;this.sync();}
  const w=this.work;if(!w)return;
  if(this.test.watching||this.test.dialogOpen){this.hoe.visible=false;return;}
  const p=this.plots[w.index],g=this.g;
  if(Math.hypot(g.player.x-p.x,g.player.y-p.y)>.75){this.hoe.visible=false;if(!g.path.length){this.work=null;g.notify();}return;}
  g.path=[];w.elapsed+=dt;
  this.hoe.visible=w.kind==='dig';this.hoe.position.set(g.player.x+.22,heightAt(g.world,g.player.x,g.player.y)+.6,-g.player.y-.25);this.hoe.rotation.set(-.7+Math.sin(w.elapsed*9)*.6,0,.3);
  if(w.elapsed<1.1)return;
  this.hoe.visible=false;this.work=null;
  const before=this.state.completed,s=this.test.farm.state;
  const next=w.kind==='harvest'?gardenHarvest(s,w.index,now):gardenWork(s,w.kind,w.index,now);
  if(this.test.farm.commit(next)){
   g.burst(p,'seed',.5);
   if(!before&&this.state.completed)this.test.celebrate('+10 coins!');
   else{this.test.pickupNotice={label:w.kind==='dig'?'Dug!':w.kind==='plant'?'Planted!':`+${HARVEST_COINS} coins`,until:this.test.elapsed+2};}
   g.notify();
  }
 }
 click(ray){
  if(!this.small)return false;
  const point=new THREE.Vector3();if(!ray.ray.intersectPlane(this.g.groundPlane,point))return false;
  const i=this.plots.findIndex(p=>Math.hypot(p.x-point.x,p.y+point.z)<.55);
  if(i<0)return false;
  if(this.state.completed)this.go(i);else if(i===gardenNext(this.state)?.index)this.go();
  return true;
 }
 snapshot(){
  const s=this.state,next=gardenNext(s),target=next?this.plots[next.index]:null;
  return {...s,pending:this.pending,busy:!!this.work,small:this.small,readyCount:this.small&&s.completed?s.readyAt.filter(t=>t<=Date.now()).length:0,
   label:!s.approved?'Make my garden bigger':next?.kind==='dig'?'Dig a spot':'Plant a seed',
   instruction:!s.approved?'Let’s make room for more vegetables. Your tools and seeds are free.':next?.kind==='dig'?'Tap the glowing spot. Walk over and dig!':'Tap the spot to plant a seed. Three seeds earn 10 coins!',
   progress:next?.kind==='dig'?`${s.dug} / 3 spots dug`:`${s.planted} / 3 seeds planted`,
   target:target?this.test.project(target,.1):null,
   crops:this.small?this.plots.map((p,i)=>({index:i,crop:p.crop,ready:s.completed&&s.readyAt[i]<=Date.now(),...this.test.project(p,.5)})):[]};
 }
 dispose(){this.g.scene.remove(this.group);this.marker?.geometry.dispose();this.marker?.material.dispose();this.ownedGeometry?.dispose();this.ownedMaterials?.forEach(m=>m.dispose());}
}
