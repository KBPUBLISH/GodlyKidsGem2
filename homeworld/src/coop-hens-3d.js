import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

/** One context draws every nest. Reuses the island's cached model and idle clip. */
export class CoopHens3D{
 constructor(root,canvas,game){
  this.root=root;this.canvas=canvas;this.game=game;this.items=[];this.disposed=false;this.dirty=true;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.setClearColor(0,0);this.renderer.autoClear=false;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.shadowGeometry=new THREE.PlaneGeometry(2,1.1);
  const stamp=document.createElement('canvas');stamp.width=stamp.height=64;const ctx=stamp.getContext('2d'),fade=ctx.createRadialGradient(32,32,3,32,32,31);fade.addColorStop(0,'rgba(47,30,15,.42)');fade.addColorStop(1,'rgba(47,30,15,0)');ctx.fillStyle=fade;ctx.fillRect(0,0,64,64);
  this.shadowTexture=new THREE.CanvasTexture(stamp);this.shadowMaterial=new THREE.MeshBasicMaterial({map:this.shadowTexture,transparent:true,depthWrite:false});
  for(const [index,slot]of [...root.querySelectorAll('[data-coop-hen]')].entries()){
   const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.4,1.4,2.6,-.1,.1,30);camera.position.set(3,2.3,5);camera.lookAt(0,.95,0);
   scene.add(new THREE.HemisphereLight('#fff5de','#917551',2.2));const sun=new THREE.DirectionalLight('#fff4dc',2.8);sun.position.set(-3,5,4);scene.add(sun);const rim=new THREE.DirectionalLight('#fff8e7',1.3);rim.position.set(3,2,-3);scene.add(rim);
   const shadow=new THREE.Mesh(this.shadowGeometry,this.shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=-.185;scene.add(shadow);
   const pivot=new THREE.Group();scene.add(pivot);const fallback=makeHen();pivot.add(fallback);
   this.items.push({id:slot.dataset.coopHen,slot,scene,camera,pivot,index,fallback,yaw:(index%3-1)*.2,reactAt:-10000});
  }
  this.resize=()=>{this.dirty=true;};this.observer=new ResizeObserver(this.resize);this.observer.observe(root);for(const item of this.items)this.observer.observe(item.slot);
  root.addEventListener('scroll',this.resize,{passive:true});document.addEventListener('visibilitychange',this.resize);
  this.tick=this.tick.bind(this);this.last=performance.now();this.raf=requestAnimationFrame(this.tick);
  game.animals.load('chicken').then(source=>{if(this.disposed)return;for(const item of this.items){
   item.pivot.remove(item.fallback);disposeOwn(item.fallback);item.fallback=null;
   const model=cloneSkinned(source.scene);model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;const copy=m=>{const local=m.clone();local.metalness=0;local.roughness=.88;return local;};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});
   model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),k=1.95/Math.max(.01,size.y);
   model.scale.setScalar(k);model.position.set(-center.x*k,-box.min.y*k,-center.z*k);item.pivot.add(model);item.model=model;
   item.mixer=new THREE.AnimationMixer(model);const clip=source.clips.CRT_chicken_Idle;if(clip){const action=item.mixer.clipAction(clip);action.time=item.index*.83;action.play();item.mixer.update(0);}
  }canvas.dataset.henModel='island-chicken';this.dirty=true;}).catch(()=>{if(!this.disposed){canvas.dataset.henModel='sculpted-chicken';this.dirty=true;}});
 }
 react(id){const item=this.items.find(i=>i.id===id);if(item){item.reactAt=performance.now();this.dirty=true;}}
 tick(now){
  if(this.disposed)return;this.raf=requestAnimationFrame(this.tick);if(document.hidden||now-this.last<1000/30)return;
  const dt=Math.min(.1,(now-this.last)/1000);this.last=now;if(this.reduced&&!this.dirty)return;this.dirty=false;
  const rootRect=this.root.getBoundingClientRect(),w=this.root.clientWidth,h=this.root.clientHeight;if(!w||!h)return;
  this.canvas.style.top=`${this.root.scrollTop}px`;if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.renderer.setSize(w,h,false);}
  this.renderer.setScissorTest(false);this.renderer.clear();this.renderer.setScissorTest(true);
  for(const item of this.items){const r=item.slot.getBoundingClientRect(),left=r.left-rootRect.left,top=r.top-rootRect.top;if(top>=h||top+r.height<=0||!r.width||!r.height)continue;
   const aspect=r.width/r.height,span=2.65;item.camera.left=-span*aspect/2;item.camera.right=span*aspect/2;item.camera.top=span/2;item.camera.bottom=-span/2;item.camera.updateProjectionMatrix();
   if(!this.reduced)item.mixer?.update(dt);
   const elapsed=(now-item.reactAt)/650,bounce=elapsed>=0&&elapsed<1&&!this.reduced?Math.sin(elapsed*Math.PI):0;
   item.pivot.position.y=-.2+bounce*.13;item.pivot.rotation.y=item.yaw+(this.reduced?0:Math.sin(now*.00045+item.index)*.055)+bounce*.08;
   this.renderer.setViewport(left,h-top-r.height,r.width,r.height);this.renderer.setScissor(Math.max(0,left),Math.max(0,h-top-r.height),Math.min(w,left+r.width)-Math.max(0,left),Math.min(h,top+r.height)-Math.max(0,top));this.renderer.render(item.scene,item.camera);
  }
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.observer?.disconnect();this.root.removeEventListener('scroll',this.resize);document.removeEventListener('visibilitychange',this.resize);for(const i of this.items){i.mixer?.stopAllAction();if(i.model){i.mixer?.uncacheRoot(i.model);const materials=new Set();i.model.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});materials.forEach(m=>m.dispose());}if(i.fallback)disposeOwn(i.fallback);}this.shadowGeometry.dispose();this.shadowMaterial.dispose();this.shadowTexture.dispose();this.renderer.dispose();this.renderer.forceContextLoss();}
}
function disposeOwn(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
// A sculpted 3D hen appears immediately while the cached animated asset resolves.
function makeHen(){
 const root=new THREE.Group(),mat=color=>new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true}),cream=mat('#fff0cd'),wing=mat('#e4c99a'),red=mat('#cb4e36'),gold=mat('#e9aa3b'),black=mat('#2d261d');
 const ball=(x,y,z,sx,sy,sz,m)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);root.add(mesh);return mesh;};
 ball(0,.8,0,.6,.65,.68,cream);ball(0,1.5,.36,.36,.4,.35,cream);for(const x of [-.5,.5])ball(x,.85,.02,.15,.4,.45,wing);for(const x of [-.2,0,.2])ball(x,1.91,.3,.13,.2,.12,red);ball(0,1.25,.65,.1,.2,.1,red);
 const beak=new THREE.Mesh(new THREE.ConeGeometry(.13,.36,4),gold);beak.rotation.x=Math.PI/2;beak.position.set(0,1.47,.78);root.add(beak);for(const x of [-.29,.29])ball(x,1.58,.53,.055,.065,.06,black);
 for(const x of [-.2,.2]){ball(x,.16,.15,.065,.19,.06,gold);ball(x,.04,.25,.15,.05,.25,gold);}for(const x of [-.23,0,.23]){const tail=ball(x,1.02,-.62,.14,.48,.15,wing);tail.rotation.x=-.6;}
 return root;
}
