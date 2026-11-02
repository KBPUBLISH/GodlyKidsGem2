import * as THREE from 'three';
import {createLivingPlayer} from './living-player-model.js';
import {KITCHEN_STATIONS,kitchenRoute} from './kitchen-navigation.mjs';

/** A whole kitchen, with counter-safe walking and one persistent avatar. */
export class KitchenRoomScene {
 constructor(canvas,avatarId,onArrive,onLayout){
  this.canvas=canvas;this.onArrive=onArrive;this.onLayout=onLayout;this.geometries=[];this.materials=new Map();this.path=[];
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8dcc2');
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.camera=new THREE.OrthographicCamera(-7,7,5,-5,.1,60);this.camera.position.set(0,12,14);this.camera.lookAt(0,.2,0);
  this.scene.add(new THREE.HemisphereLight('#fff8df','#829786',2.8));const sun=new THREE.DirectionalLight('#fff1cf',3.2);sun.position.set(-6,12,6);this.scene.add(sun);
  this.box(0,-.22,0,12.5,.4,8,'#a77650');
  for(let x=0;x<12;x++)for(let z=0;z<8;z++)this.box(x-5.5,0,z-3.5,.98,.04,.98,(x+z)%2?'#f1dfb5':'#e5cfa2');
  this.box(0,1.2,-3.7,12.5,2.4,.22,'#a1b9a0');this.box(0,.45,-3.52,12.5,.9,.14,'#688e81');
  this.box(0,2.47,-3.7,12.7,.12,.35,'#efdbb1');
  // A sunny garden window and herb pots behind the worktops.
  this.box(0,1.85,-3.51,2.5,1.1,.12,'#fff2d1');this.box(0,1.85,-3.42,2.28,.9,.05,'#a8d9db');
  this.ball(.6,2.08,-3.37,.18,.18,.03,'#ffda79');this.box(0,1.85,-3.3,.07,1,.1,'#fff6df');this.box(0,1.85,-3.3,2.4,.07,.1,'#fff6df');
  for(const s of KITCHEN_STATIONS){
   this.box(s.x,.54,s.z,2.45,1.05,1.32,s.id==='serve'?'#7fa89b':'#cfab78');
   this.box(s.x,1.11,s.z,2.58,.16,1.48,'#fff0d0');
   this.box(s.x,.54,s.z+.68,2.15,.75,.04,s.id==='serve'?'#a9c7ae':'#e9c899');
   this.box(s.x,.83,s.z+.74,.42,.07,.08,'#97754e');
  }
  // Pantry shelves: produce visibly appears and disappears with the real bag.
  for(const y of [1.4,2.05])this.box(-4.35,y,-2.6,2.5,.1,.6,'#a87950');
  this.produce={};for(const [i,id] of ['pumpkin','carrot','egg','fish','potato'].entries()){
   const g=new THREE.Group();g.position.set(-5.15+(i%3)*.76,i<3?1.58:2.24,-2.55);this.scene.add(g);this.produce[id]=g;
   this.ball(0,0,0,.23,id==='carrot'?.1:.2,.2,['#e79a40','#f69c44','#fff0ca','#79b6bb','#c6a46b'][i],g);
   if(i<2)this.ball(0,.19,0,.1,.16,.1,'#6c9c55',g);
  }
  this.box(-1.45,1.23,-1.8,1.8,.08,.83,'#b4814a');
  for(let i=0;i<3;i++)this.ball(-1.85+i*.36,1.32,-1.8,.12,.1,.27,'#ef9c3f');
  const knife=this.box(-.92,1.32,-1.9,.09,.12,.6,'#d5dfd8');knife.rotation.y=.3;this.box(-.82,1.32,-1.51,.09,.12,.25,'#6f8b7c');
  this.box(1.45,1.24,-2,1.45,.12,1.05,'#526a64');
  this.ball(1.45,1.48,-2,.56,.36,.48,'#708f87');this.ball(1.45,1.75,-2,.48,.03,.41,'#edb559');
  for(const x of [.78,2.12])this.box(x,1.52,-2,.28,.12,.17,'#4d6861');
  this.spoon=this.box(1.68,1.9,-2,.07,.6,.07,'#aa774c');this.spoon.rotation.z=-.35;
  this.box(4.35,1.65,-2.3,1.8,1.05,1.1,'#c88b5f');this.ball(4.35,1.69,-1.72,.65,.43,.05,'#463e39');
  this.fire=this.ball(4.35,1.56,-1.65,.43,.16,.04,'#f8b34f');this.box(4.85,2.4,-2.55,.45,.6,.45,'#e0b48b');
  this.plate=this.ball(3.65,1.24,2.65,.65,.07,.48,'#fff8e3');
  this.served=this.ball(3.65,1.35,2.65,.38,.14,.29,'#e5a34f');this.served.visible=false;
  this.box(2.85,1.25,2.7,.06,.04,.65,'#78928c');this.box(4.45,1.25,2.7,.06,.04,.65,'#78928c');
  this.chef=createLivingPlayer(avatarId);this.chef.model.position.set(-4.35,.06,-.35);this.chef.model.rotation.y=Math.PI;this.scene.add(this.chef.model);
  const hat=new THREE.Group();hat.position.y=.43;this.chef.bones.mixamorigHead.add(hat);
  this.box(0,0,0,.62,.21,.57,'#fff9e9',hat);for(const x of [-.2,0,.2])this.ball(x,.2,0,.23,.25,.25,'#fffcf0',hat);
  this.box(0,.82,.235,.44,.43,.035,'#fff1cf',this.chef.model);
  this.tray=new THREE.Group();this.tray.position.set(0,.81,.6);this.chef.model.add(this.tray);this.box(0,0,0,.85,.06,.55,'#7fa69c',this.tray);this.ball(0,.12,0,.25,.12,.2,'#efb35d',this.tray);this.tray.visible=false;
  this.ring=this.mesh(new THREE.RingGeometry(.52,.64,40),0,.04,0,'#fff3b1');this.ring.rotation.x=-Math.PI/2;
  this.steam=[];for(let i=0;i<3;i++)this.steam.push(this.ball(1.2+i*.25,2+i*.13,-2,.08,.14,.08,'#fff2d9'));
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();this.last=0;this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
 }
 material(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));return this.materials.get(color);}
 mesh(geometry,x,y,z,color,parent=this.scene){this.geometries.push(geometry);const mesh=new THREE.Mesh(geometry,this.material(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
 box(x,y,z,w,h,d,color,parent){return this.mesh(new THREE.BoxGeometry(w,h,d),x,y,z,color,parent);}
 ball(x,y,z,w,h,d,color,parent){const mesh=this.mesh(new THREE.SphereGeometry(1,12,8),x,y,z,color,parent);mesh.scale.set(w,h,d);return mesh;}
 set({next,carrying,working,done,counts,action,progress}){
  this.next=next;this.tray.visible=carrying;this.working=working;this.served.visible=done;
  this.action=action;if(progress!==this.progress)this.chopUntil=performance.now()+350;this.progress=progress;
  for(const [id,model] of Object.entries(this.produce))model.visible=(counts[id]||0)>0;
  const station=KITCHEN_STATIONS.find(s=>s.id===next);if(station)this.ring.position.set(station.x,.05,station.standZ);
 }
 moveTo(id){
  this.destination=id;this.path=kitchenRoute(this.chef.model.position,id);
  if(this.reduced&&this.path.length){const p=this.path.at(-1);this.chef.model.position.set(p.x,.06,p.z);this.path=[];this.arrive();}
 }
 arrive(){const station=KITCHEN_STATIONS.find(s=>s.id===this.destination);this.chef.model.rotation.y=station?.id==='serve'?0:Math.PI;this.onArrive(this.destination);}
 resize(){
  const {width,height}=this.canvas.getBoundingClientRect();if(!width||!height)return;
  this.renderer.setSize(width,height,false);const h=Math.max(8.5,13.5/(width/height));this.camera.left=-h*width/height/2;this.camera.right=-this.camera.left;this.camera.top=h/2;this.camera.bottom=-h/2;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  this.onLayout(KITCHEN_STATIONS.map(s=>{const p=new THREE.Vector3(s.x,s.id==='serve'?1.1:2.65,s.z).project(this.camera);return {id:s.id,left:(p.x+1)*50,top:(1-p.y)*50};}));
 }
 tick(t){
  this.raf=requestAnimationFrame(this.tick);if(document.hidden||t-this.last<1000/30)return;const dt=Math.min((t-this.last)/1000,.05);this.last=t;
  const p=this.chef.model.position,target=this.path[0];
  if(target){const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),distance=3.5*dt;if(d<=distance){p.x=target.x;p.z=target.z;this.path.shift();if(!this.path.length)this.arrive();}else{p.x+=dx/d*distance;p.z+=dz/d*distance;this.chef.model.rotation.y=Math.atan2(dx,dz);}}
  this.chef.update(this.reduced?0:dt,target?3:0,this.reduced?0:t/1000,{carrying:this.tray.visible,celebrating:!this.reduced&&this.served.visible&&!target});
  if(this.working&&!target){const arm=this.chef.bones.mixamorigRightArm;arm.rotation.x=-.8;arm.rotation.z=-.2;if(!this.reduced&&this.action==='stir'){arm.rotation.x+=Math.sin(this.progress*Math.PI*2)*.25;arm.rotation.z+=Math.cos(this.progress*Math.PI*2)*.25;}}
  if(!this.reduced){
   this.ring.scale.setScalar(1+Math.sin(t*.004)*.08);this.fire.scale.y=.16+Math.sin(t*.008)*.025;
   this.steam.forEach((s,i)=>{s.position.y=2+((t*.0004+i*.3)%1);s.scale.setScalar(.08+((t*.0004+i*.3)%1)*.04);});
   if(this.working&&this.action==='stir')this.spoon.rotation.z=-.35+Math.sin(this.progress*Math.PI*2)*.5;
   const arm=this.chef.bones.mixamorigRightArm;if(this.working&&t<this.chopUntil)arm.rotation.x-=Math.sin((this.chopUntil-t)/350*Math.PI)*.5;
  }
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){cancelAnimationFrame(this.raf);this.observer.disconnect();this.chef.dispose();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.forceContextLoss();}
}
