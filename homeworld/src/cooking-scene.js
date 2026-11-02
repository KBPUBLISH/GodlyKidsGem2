import * as THREE from 'three';
/** One small renderer, capped at 30fps / 1.5 DPR; all resources disposed on exit. */
export class CookingScene{
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.1,40);this.camera.position.set(-.35,3.4,4.4);this.camera.lookAt(-.25,.8,.25);
  this.scene.add(new THREE.HemisphereLight('#fff7dc','#9c7453',2.4));const sun=new THREE.DirectionalLight('#ffebbc',3);sun.position.set(-3,6,4);this.scene.add(sun);
  this.materials=new Map();this.geometries=[];
  this.box(0,.1,0,5,.4,3,'#8c5435');for(let i=0;i<9;i++)this.box((i-4)*.55,.33,0,.53,.12,3,'#c58c50');
  // Stone hearth, arched mouth, brick surround, glowing fire and chimney.
  this.box(1.4,.65,-.8,1.6,.55,1.25,'#9b9586');this.ball(1.4,1.12,-.8,.82,.9,.65,'#b99c7d');this.ball(1.4,1.12,-.22,.5,.58,.08,'#3c2a25');
  for(let i=0;i<9;i++){const a=i*Math.PI/8;const b=this.box(1.4+Math.cos(a)*.57,1.03+Math.sin(a)*.65,-.16,.25,.25,.2,i%2?'#d9bc91':'#b89b77');b.rotation.z=a;}
  this.box(1.4,.83,-.05,1.3,.12,.6,'#80776b');this.box(1.65,2.03,-.9,.45,.65,.45,'#b1a48b');this.box(1.65,2.4,-.9,.6,.13,.6,'#d6c29d');
  this.fire=this.ball(1.4,1.04,-.12,.28,.21,.03,'#ffac32');this.box(-1.2,.46,.48,1.75,.1,1.3,'#edbc77');
  // Pot on its own stone ring: all stations belong to this one experience.
  this.ball(-1.3,.75,-.95,.58,.4,.5,'#526d65');this.ball(-1.3,1,-.95,.52,.05,.45,'#e5983b');
  this.pot=this.box(-1.9,.82,-.95,.28,.12,.15,'#374d48');this.box(-.7,.82,-.95,.28,.12,.15,'#374d48');
  this.food=new THREE.Group();this.scene.add(this.food);this.action='slice';this.progress=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();this.last=0;this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
 }
 material(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.78}));return this.materials.get(color);}
 mesh(geo,x,y,z,color,parent=this.scene){this.geometries.push(geo);const m=new THREE.Mesh(geo,this.material(color));m.position.set(x,y,z);parent.add(m);return m;}
 box(x,y,z,w,h,d,c,p){return this.mesh(new THREE.BoxGeometry(w,h,d),x,y,z,c,p);}
 ball(x,y,z,w,h,d,c,p){const m=this.mesh(new THREE.SphereGeometry(1,16,10),x,y,z,c,p);m.scale.set(w,h,d);return m;}
 set(recipe,action,progress){
  this.action=action;this.progress=progress;const signature=`${recipe}:${action}:${Math.floor(progress)}`;if(this.signature===signature)return;this.signature=signature;this.spoon=null;this.food.clear();
  // Rebuild only this handful of food primitives on a discrete interaction.
  this.foodGeometry??=[];this.foodGeometry.forEach(g=>{g.dispose();this.geometries.splice(this.geometries.indexOf(g),1);});const first=this.geometries.length;
  const egg=recipe==='garden_omelette',fish=recipe==='fish_chips';
  if(action==='stir'||action==='add'){
   this.ball(-.65,.65,.65,.65,.23,.55,'#78aaa1',this.food);this.ball(-.65,.85,.65,.59,.03,.49,egg?'#ffd66e':'#f4a447',this.food);
   this.spoon=this.box(-.45,1.12,.6,.08,.55,.08,'#9b6138',this.food);this.spoon.rotation.z=.5;
  }else if(action==='bake'||action==='cooking'||action==='collected'){
   this.box(-.4,.53,.65,1.8,.06,1,'#596d6c',this.food);this.ball(-.8,.65,.65,.45,.12,.24,egg?'#ffd256':fish?'#db954c':'#dc8034',this.food);
   for(let i=0;i<5;i++)this.box(.05+i*.13,.66,.65,.08,.12,.55,'#f5c460',this.food);
  }else if(action==='crack'){
   for(let i=0;i<2;i++){this.ball(-1.5+i*.6,.8,.5,.22,.3,.22,i<progress?'#f5c14c':'#fff0d2',this.food);}
  }else{
   for(let i=0;i<(progress?4:2);i++){
    const m=this.ball(-1.7+i*.4,.68,.5,progress?.17:.28,.17,fish?.22:.38,fish?'#d5b17c':'#ee913a',this.food);m.rotation.y=.5;
    if(!fish)this.ball(-1.7+i*.4,.77,.25,.08,.15,.09,'#679441',this.food);
   }
   if(action==='prepare'){this.ball(-.9,.7,.5,.6,.2,.22,'#87b9be',this.food);this.ball(-.48,.77,.6,.04,.04,.04,'#263f42',this.food);}
  }
  this.foodGeometry=this.geometries.slice(first);
 }
 resize(){const {width,height}=this.canvas.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
 tick(t){this.raf=requestAnimationFrame(this.tick);if(document.hidden||t-this.last<1000/30)return;this.last=t;
  if(!this.reduced){this.fire.scale.y=.2+Math.sin(t*.006)*.035;if(this.spoon)this.spoon.rotation.z=.5+Math.sin(t*.002)*.12;this.food.position.y=Math.sin(t*.002)*.015;}
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){cancelAnimationFrame(this.raf);this.observer.disconnect();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.forceContextLoss();}
}
