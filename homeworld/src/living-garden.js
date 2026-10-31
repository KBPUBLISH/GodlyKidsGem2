import * as THREE from 'three';
import {heightAt,cellFromKey} from './core.mjs';
import {gardenAvailable,gardenNext,gardenJob,gardenCrop,gardenWork,gardenHarvest,GARDEN_CROPS,CARROT_SPOTS,HARVEST_COINS} from './living-garden-rules.mjs';
import {FARM_ACTION_SECONDS} from './living-action-motion.mjs';

export class LivingGarden {
 constructor(test){
  this.test=test;this.g=test.g;this.work=null;this.animating=false;this.promptNodes=new Map();
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
   p.soil=add('tile_tilled_dry',p.x,p.y);p.wetSoil=add('tile_seeded_wet',p.x,p.y);
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
  const s=this.state,now=Date.now();
  this.plots.forEach((p,i)=>{const crop=gardenCrop(s,i,now),wet=crop.phase==='growing';p.soil.visible=!wet;p.wetSoil.visible=wet;p.cropObject.visible=crop.phase!=='empty';p.cropObject.scale.setScalar(crop.phase==='ready'?1:.18+.65*crop.progress);});
  for(const h of this.highlights){const job=gardenJob(s,h.index,now);h.tile.visible=!!job&&job.kind!=='wait';h.fill.material.color.set(job?.kind==='water'?'#7ddfff':job?.kind==='plant'?'#a7ed7c':'#ffdf73');}
  this.marker.visible=false;
 }
 cancel(){this.test.actions.clear(this.work);this.work=null;this.animating=false;}
 go(index){
  if(!this.small||this.g.action||this.g.order||this.g.store.state.night)return;
  this.test.activity();
  const now=Date.now(),job=index===undefined?gardenNext(this.state,now):gardenJob(this.state,index,now);
  if(!job||this.work)return false;
  if(job.kind==='wait'){this.g.toast(`${job.crop[0].toUpperCase()+job.crop.slice(1)} · ${Math.ceil(job.remaining/60000)} min to grow`);return false;}
  const p=this.plots[job.index];this.test.walk(p);this.work={kind:job.kind,index:job.index,elapsed:0};this.g.notify();return true;
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
  g.path=[];w.elapsed+=dt;
  this.animating=true;this.test.actions.pose(w,w.kind,w.elapsed,p);
  if(w.elapsed<FARM_ACTION_SECONDS[w.kind])return;
  this.cancel();
  const before=this.state.rewarded,s=this.test.farm.state;
  const next=w.kind==='harvest'?gardenHarvest(s,w.index,now):gardenWork(s,w.kind,w.index,now);
  if(this.test.farm.commit(next)){
   g.burst(p,w.kind==='water'?'water':'seed',.5);
   if(!before&&this.state.rewarded)this.test.celebrate('+10 coins!');
   else{this.test.pickupNotice={label:w.kind==='plant'?'Planted!':w.kind==='water'?'Watered!':`+${HARVEST_COINS} coins`,until:this.test.elapsed+2};}
   g.notify();
  }
 }
 click(ray){
  if(!this.small)return false;
  const point=new THREE.Vector3();if(!ray.ray.intersectPlane(this.g.groundPlane,point))return false;
  const i=this.plots.findIndex(p=>Math.hypot(p.x-point.x,p.y+point.z)<.55);
  if(i<0)return false;
  this.go(i);
  return true;
 }
 bindPrompt(index,node){
  if(node)this.promptNodes.set(index,node);else this.promptNodes.delete(index);
  this.updatePrompts();
 }
 updatePrompts(){
  if(!this.promptNodes.size)return;
  const g=this.g;g.camera.updateMatrixWorld(true);
  // Read layout once before writing any styles; never drive React at frame rate.
  const rect=g.renderer.domElement.getBoundingClientRect(),point=new THREE.Vector3();
  for(const [index,node] of this.promptNodes){
   const plot=this.plots[index],near=Math.hypot(g.player.x-plot.x,g.player.y-plot.y)<=3.2;
   point.set(plot.x,heightAt(g.world,plot.x,plot.y)+.4,-plot.y).project(g.camera);
   const visible=near&&point.z>=-1&&point.z<=1&&Math.abs(point.x)<.95&&Math.abs(point.y)<.85&&!g.overview&&!g.siteView&&!g.interior;
   node.style.display=visible?'':'none';
   node.style.left=`${(point.x+1)*rect.width/2}px`;node.style.top=`${(1-point.y)*rect.height/2}px`;
  }
 }
 snapshot(){
  const s=this.state,now=Date.now(),next=gardenNext(s,now),phase=next?.kind||'wait',target=next?this.plots[next.index]:null;
  const seconds=phase==='wait'?Math.ceil(next.remaining/1000):0,format=ms=>{const n=Math.ceil(ms/1000);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
  const watered=CARROT_SPOTS.filter(i=>s.wateredAt[i]!==null).length,picked=Object.values(s.picked).reduce((a,b)=>a+b,0);
  const crops=this.small?this.plots.map((p,i)=>({index:i,...gardenCrop(s,i,now),...this.test.project(p,.5)})):[];
  return {...s,busy:!!this.work,small:this.small,phase,seconds,timer:format(next?.remaining||0),
   readyCount:crops.filter(c=>c.phase==='ready'&&s.planted===4).length,thirstyCount:crops.filter(c=>c.phase==='thirsty'&&s.planted===4).length,
   label:phase==='plant'?'Plant a carrot seed':phase==='water'?`Water ${target.crop}`:phase==='harvest'?`Pick a ${target.crop}`:'Vegetables are growing',
   instruction:phase==='plant'?'Tap a glowing spot to plant a carrot seed. Four seeds earn 10 coins!':phase==='water'?'Tap a blue drop to water your carrots. They need water to grow.':phase==='wait'?'Your carrots are growing. Gather logs or explore while you wait.':'Pick one carrot, one pumpkin and one lettuce.',
   progress:phase==='plant'?`${s.planted} / 4 carrot seeds planted`:phase==='water'?`${watered} / 4 carrots watered`:`${picked} / 3 vegetables picked`,
   value:phase==='plant'?s.planted:phase==='water'?watered:picked,total:phase==='plant'||phase==='water'?4:3,
   spots:this.small?gardenAvailable(s).map(index=>{const job=gardenJob(s,index,now);return {...job,timer:format(job.remaining),...this.test.project(this.plots[index],.4)};}):[],
   target:target?this.test.project(target,.1):null,crops};
 }

 dispose(){this.promptNodes.clear();this.g.scene.remove(this.group);this.highlights?.forEach(h=>h.tile.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}));this.marker?.geometry.dispose();this.marker?.material.dispose();this.ownedGeometry?.dispose();this.ownedMaterials?.forEach(m=>m.dispose());}
}
