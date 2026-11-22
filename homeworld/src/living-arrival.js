import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cameraOffset} from './view-controls.mjs';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const release=root=>{root?.traverse(o=>{o.geometry?.dispose();for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});};

/** A short, optional welcome on the child's actual island; no extra scene download. */
export class LivingArrival {
 constructor(test){
  this.test=test;this.g=test.g;this.time=0;this.active=true;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.phase=this.reduced?'hello':'wake';this.originalYaw=this.g.actor.rotation.y;this.g.actor.rotation.y=.12;
  this.name=test.playerName.split(/\s+/)[0]||'friend';this.line=`Hey there, ${this.name}! Welcome to your own island. Let’s plant your first seeds!`;
  this.abort=new AbortController();this.bird=new THREE.Group();this.g.scene.add(this.bird);
  this.loadBird();test.tasksOpen=false;
 }
 async loadBird(){
  try{
   const response=await fetch('/models/mobile/perry-flight.glb?v=1',{signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(12000)])});if(!response.ok)return;
   const loader=new GLTFLoader().setDRACOLoader(this.g.draco),gltf=await loader.parseAsync(await response.arrayBuffer(),'/models/mobile/');
   if(!this.active){release(gltf.scene);return;}
   const model=gltf.scene,clip=gltf.animations.find(c=>/introduction|sideways/i.test(c.name))||gltf.animations[0];
   if(clip)for(const track of clip.tracks)if(/(?:SmartRigArmature|Parrot2_Rig)\.position$/.test(track.name))for(let i=0;i<track.values.length;i+=3){track.values[i]=0;track.values[i+2]=0;}
   this.mixer=new THREE.AnimationMixer(model);if(clip)this.mixer.clipAction(clip).play();this.mixer.update(0);model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(V()),center=bounds.getCenter(V());
   const scale=.95/Math.max(size.y,size.x*.7,.001);model.scale.setScalar(scale);model.position.copy(center).multiplyScalar(-scale);
   this.bird.add(model);this.birdReady=true;this.g.notify();
  }catch{/* The arrival and garden remain usable without Perry's optional model. */}
 }
 speak(force=false){if(force||this.g.music?.on!==false)this.test.speak(this.line);}
 update(dt){
  if(!this.active||document.hidden)return;
  this.time+=Math.min(.2,dt);this.g.path=[];this.g.keys.clear();
  const t=this.time,progress=this.reduced?1:ease((t-2.1)/4),g=this.g;
  const target=g.actor.position.clone().add(V(0,THREE.MathUtils.lerp(1.45,1,progress),0));
  g.focus.copy(target);g.zoom=THREE.MathUtils.lerp(1.9,13,progress);g.updateProjection();
  g.camera.up.set(0,1,0);g.camera.position.copy(target).add(V(.5,.45,8).lerp(V(...cameraOffset(0,false,0)),progress));g.camera.lookAt(target);
  if(!this.reduced) this.test.playerVisual.arrive(t);
  const fly=this.reduced?1:ease((t-3.3)/2.5);
  this.bird.visible=fly>0;this.bird.position.copy(g.actor.position).add(V(THREE.MathUtils.lerp(-4,.75,fly),2.7+Math.sin(t*3)*.10,THREE.MathUtils.lerp(-2,.25,fly)));
  this.bird.rotation.y=.15;this.mixer?.update(this.reduced?0:dt);
  if((t>=6.1||this.reduced)&&!this.greeted){this.greeted=true;this.phase='hello';this.speak();g.notify();}
 }
 snapshot(){return this.active?{phase:this.phase,name:this.name,birdReady:!!this.birdReady,reduced:this.reduced}:null;}
 finish(plant=false){
  if(!this.active)return;this.active=false;this.abort.abort();this.g.scene.remove(this.bird);release(this.bird);this.mixer?.stopAllAction();
  const g=this.g;g.zoom=13;g.viewYaw=0;g.viewPitch=0;g.focus.copy(g.actor.position).add(V(0,1,0));g.resize();g.actor.rotation.y=this.originalYaw;
  g.store.save({...g.store.state,livingArrivalSeen:true});this.test.tasksOpen=false;this.test.dialogOpen=false;this.test.activity();
  if(window.parent!==window)window.parent.postMessage({type:'gk-living-voice-stop'},location.origin);
  if(plant)this.test.garden.go();g.notify();g.renderer.domElement.focus({preventScroll:true});
 }
 dispose(){this.active=false;this.abort.abort();this.g.scene.remove(this.bird);this.mixer?.stopAllAction();release(this.bird);}
}
