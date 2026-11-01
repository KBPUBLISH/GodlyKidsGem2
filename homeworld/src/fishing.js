import * as THREE from 'three';
import {heightAt} from './core.mjs';
import {fishModel} from './nutrition.js';
import {FISHING_DOCK_LENGTH as DOCK_LENGTH,FISHING_DOCK_WIDTH as DOCK_WIDTH,FISHING_DOCK_START as DOCK_START} from './fishing-dock.mjs';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const toScene=p=>V(p[0],p[2],-p[1]);
const wood=color=>new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true});

/**
 * A proper storybook fishing rod: tapered varnished blank, cork grips around a dark reel seat, red thread wraps
 * holding six line guides, and a spinning reel (housing, spool, bail and a crank handle). The whole rod is 1.9 m
 * along +Y with the butt at the origin; `reel` is the part that turns when the kid cranks the handle.
 */
export function buildRod(){
  const rod=new THREE.Group();
  const varnish=new THREE.MeshPhysicalMaterial({color:'#6e3f1d',roughness:.32,metalness:0,clearcoat:.7,clearcoatRoughness:.25});
  const cork=new THREE.MeshStandardMaterial({color:'#d2ac73',roughness:.95});
  const seat=new THREE.MeshStandardMaterial({color:'#2a2a30',roughness:.45,metalness:.55});
  const brass=new THREE.MeshStandardMaterial({color:'#d8b36a',roughness:.3,metalness:.75});
  const steel=new THREE.MeshStandardMaterial({color:'#cfd6dc',roughness:.28,metalness:.9});
  const wrap=new THREE.MeshStandardMaterial({color:'#b8322b',roughness:.75});
  const knob=new THREE.MeshStandardMaterial({color:'#3b2415',roughness:.6});
  // blank: lathe for a smooth taper, butt radius 10 mm → tip 2.5 mm
  const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push(new THREE.Vector2(THREE.MathUtils.lerp(.0105,.0025,Math.pow(t,.8)),.42+t*1.48));}
  const blank=new THREE.Mesh(new THREE.LatheGeometry(pts,12),varnish);rod.add(blank);
  // grips + reel seat
  const rear=new THREE.Mesh(new THREE.CylinderGeometry(.021,.024,.2,12),cork);rear.position.y=.1;rod.add(rear);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.02,12),seat);cap.position.y=.0;rod.add(cap);
  const rs=new THREE.Mesh(new THREE.CylinderGeometry(.017,.017,.13,12),seat);rs.position.y=.265;rod.add(rs);
  for(const y of[.215,.315]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.018,.004,8,16),brass);ring.rotation.x=Math.PI/2;ring.position.y=y;rod.add(ring);}
  const fore=new THREE.Mesh(new THREE.CylinderGeometry(.016,.02,.12,12),cork);fore.position.y=.39;rod.add(fore);
  // guides with thread wraps, shrinking toward the tip
  const guideY=[.62,.86,1.1,1.33,1.54,1.72,1.88],guideR=[.03,.025,.021,.017,.014,.011,.008];
  guideY.forEach((y,i)=>{const r=blankRadius(y),ring=new THREE.Mesh(new THREE.TorusGeometry(guideR[i],.0022,6,14),steel);ring.position.set(.0,y,r+guideR[i]+.004);rod.add(ring);
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(r+.002,r+.002,.028,10),wrap);foot.position.y=y;rod.add(foot);
    if(i<guideY.length-1){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.0018,.0018,guideR[i]+.006,5),steel);leg.rotation.x=Math.PI/2;leg.position.set(0,y,r+(guideR[i]+.006)/2);rod.add(leg);}});
  // spinning reel hanging under the seat
  const reel=new THREE.Group();reel.position.set(0,.265,-.03);
  const stem=new THREE.Mesh(new THREE.BoxGeometry(.012,.02,.045),seat);stem.position.z=-.02;reel.add(stem);
  const body=new THREE.Mesh(new THREE.SphereGeometry(.03,14,10),seat);body.scale.set(1,1.1,.85);body.position.z=-.055;reel.add(body);
  const spool=new THREE.Group();spool.position.set(0,.03,-.075);
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.034,18),brass);spool.add(drum);
  const lip=new THREE.Mesh(new THREE.CylinderGeometry(.034,.034,.006,18),steel);lip.position.y=.02;spool.add(lip);
  const line=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.03,18),new THREE.MeshStandardMaterial({color:'#efe6cf',roughness:.8}));spool.add(line);
  const bail=new THREE.Mesh(new THREE.TorusGeometry(.036,.0025,6,20,Math.PI*1.1),steel);bail.rotation.x=Math.PI/2;bail.position.y=.028;spool.add(bail);
  reel.add(spool);
  const crank=new THREE.Group();crank.position.set(.034,0,-.055);
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.03,8),steel);axle.rotation.z=Math.PI/2;crank.add(axle);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.008,.05,.006),brass);arm.position.set(.016,.02,0);crank.add(arm);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.026,10),knob);handle.rotation.z=Math.PI/2;handle.position.set(.03,.04,0);crank.add(handle);
  reel.add(crank);rod.add(reel);
  rod.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
  return {rod,reel:crank,spool,tipY:1.9};
  function blankRadius(y){const t=THREE.MathUtils.clamp((y-.42)/1.48,0,1);return THREE.MathUtils.lerp(.0105,.0025,Math.pow(t,.8));}
}

const PLANK=.42;
const CAST_CYCLE=1.7;            // seconds for the power meter to swing up and back
const BITE_WINDOW=2.8;           // seconds to start reeling once the bobber dips
const REEL_PER_TURN=.17;         // progress per full handle turn while the fish is calm
const TENSION_PER_TURN=.62;      // tension per full handle turn while the fish fights
export const SWEET_SPOT=[.72,.92]; // cast power window that lands the bobber where the fish are (quicker bite)

/**
 * First-person dock fishing. The character walks to the shore, steps onto the
 * dock, and the view drops into their eyes: hold to charge a cast, wait for the
 * bobber to dip, then turn the reel to land the fish. Fights happen in bursts —
 * reel while the fish is calm, hold steady while it pulls, or the line snaps.
 */
export class Fishing {
  constructor(game){
    this.g=game;this.active=false;this.phase='idle';this.a=null;
    this.spot=game.world.fishingSpots?.[0]||null;
    this.camera=new THREE.PerspectiveCamera(68,1,.08,320);
    this.fade=0;this.fadeDir=0;this.shake=0;this.caught=0;this.target=1;this.turns=0;
    this.message='';this.power=0;this.progress=0;this.tension=0;this.struggling=false;this.fish=null;this.bites=0;this.escapes=0;
    if(this.spot)this.buildDock();
  }

  buildDock(){
    const g=this.g,s=this.spot,shore=toScene(s.position),water=toScene(s.water);
    const dir=water.clone().sub(shore);dir.y=0;dir.normalize();this.dir=dir;
    const deckY=Math.max(heightAt(g.world,s.position[0],s.position[1]),s.water[2])+.34;this.deckY=deckY;
    const dock=new THREE.Group();dock.position.copy(shore).setY(deckY);dock.rotation.y=Math.atan2(dir.x,dir.z);
    const plankMat=wood('#9a7046'),darkMat=wood('#6f4d2d'),postMat=wood('#5b3f26');
    const planks=Math.round(DOCK_LENGTH/PLANK);
    for(let i=0;i<planks;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(DOCK_WIDTH,.08,PLANK-.05),i%3===1?darkMat:plankMat);p.position.set(0,0,.25+PLANK*(i+.5));p.rotation.y=(i%2?1:-1)*.012;p.castShadow=p.receiveShadow=true;dock.add(p);}
    for(const side of[-1,1]){const beam=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,DOCK_LENGTH+.2),postMat);beam.position.set(side*(DOCK_WIDTH/2-.09),-.09,.25+DOCK_LENGTH/2);dock.add(beam);
      for(let z=.6;z<=DOCK_LENGTH;z+=1.2){const post=new THREE.Mesh(new THREE.CylinderGeometry(.075,.085,1.4,8),postMat);post.position.set(side*(DOCK_WIDTH/2-.05),-.55,.25+z);dock.add(post);}
    }
    // short rail on the left so there is something to lean the rod on
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2.1,8),postMat);rail.rotation.x=Math.PI/2;rail.position.set(-(DOCK_WIDTH/2-.05),.5,.25+DOCK_LENGTH-1.15);dock.add(rail);
    for(const z of[DOCK_LENGTH-2.1,DOCK_LENGTH-.2]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.045,.05,.6,8),postMat);p.position.set(-(DOCK_WIDTH/2-.05),.26,.25+z);dock.add(p);}
    g.scene.add(dock);this.dock=dock;
    // The spare rod waits on the seaward edge of the planks, where the child
    // can walk up to it and tap it to fish.
    const side=V(-dir.z,0,dir.x),poleAt=shore.clone().addScaledVector(dir,DOCK_START+DOCK_LENGTH-.48).addScaledVector(side,DOCK_WIDTH/2-.16);poleAt.y=deckY+.04;
    const pole=new THREE.Group();pole.position.copy(poleAt);pole.rotation.set(0,Math.atan2(dir.x,dir.z)+.6,-.38);
    pole.add(buildRod().rod);
    const pLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,1.9,0),V(.12,.9,.1),V(.18,.1,.16)]),new THREE.LineBasicMaterial({color:'#f7ecd0',transparent:true,opacity:.8}));pole.add(pLine);
    const pBob=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),wood('#e7623f'));pBob.position.set(.18,.1,.16);pole.add(pBob);
    const hit=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,1.9,8),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.9;pole.add(hit);this.poleHit=hit;
    g.scene.add(pole);this.pole=pole;this.polePoint={x:poleAt.x,y:-poleAt.z};
    this.end=shore.clone().addScaledVector(dir,.25+DOCK_LENGTH-.55).setY(deckY+.04);
    this.stand=shore.clone().addScaledVector(dir,.25+DOCK_LENGTH-1.35).setY(deckY+.04);
    this.eye=this.stand.clone().add(V(0,1.52,0));
    this.waterY=s.water[2];
    // first-person rod, bobber and line
    const built=buildRod();this.rod=built.rod;this.reelMesh=built.reel;this.spoolMesh=built.spool;this.rodTipY=built.tipY;
    this.rod.visible=false;g.scene.add(this.rod);
    this.bobber=new THREE.Group();const top=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),wood('#e7623f'));top.position.y=.03;this.bobber.add(top);const base=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),wood('#fff4d8'));base.position.y=-.03;this.bobber.add(base);this.bobber.visible=false;g.scene.add(this.bobber);
    this.line=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(66),3)),new THREE.LineBasicMaterial({color:'#f7ecd0',transparent:true,opacity:.9}));this.line.visible=false;this.line.frustumCulled=false;g.scene.add(this.line);
    this.fish=fishModel();this.fish.visible=false;g.scene.add(this.fish);
  }

  get available(){return !!this.spot;}
  /** Nav target on land where the dock meets the shore. */
  landing(){const s=this.spot;return {x:s.position[0],y:s.position[1]};}

  /** Called by Nutrition.begin for a fish action. */
  enter(a,target=1){
    if(!this.spot){a.failed=true;return;}
    this.a=a;this.active=true;this.caught=0;this.target=Math.max(1,target);this.bites=0;this.escapes=0;
    this.phase='arrive';this.t=0;this.fade=0;this.fadeDir=1;this.firstPerson=false;this.turns=0;
    this.g.actor.visible=true;this.standActor();if(this.pole)this.pole.visible=false;
    this.message=`${this.name()} steps onto the dock…`;
    this.g.status='Walking out onto the dock…';this.g.notify();
  }
  name(){return this.g.actor?.userData?.name||this.g.store.state.characters?.[this.g.store.state.activeCharacter]?.name||'Your friend';}
  standActor(){const g=this.g;g.actor.position.copy(this.stand);g.actor.rotation.y=Math.atan2(this.dir.x,this.dir.z);}

  /** Kid let go of the Stop button: leave without finishing the current fish. */
  quit(){
    if(!this.active)return;
    const a=this.a;this.leave();
    if(a){a.cancelled=true;a.duration=0;}
    this.g.status=this.caught?`${this.name()} caught ${this.caught} fish and headed back.`:`${this.name()} put the rod away.`;
    this.g.finishAction();
  }
  leave(){
    this.active=false;this.firstPerson=false;this.phase='idle';this.a=null;if(this.pole)this.pole.visible=true;
    this.rod.visible=false;this.bobber.visible=false;this.line.visible=false;this.fish.visible=false;
    const g=this.g;g.livingTest?.activity();g.actor.visible=!g.store.state.characters?.[g.store.state.activeCharacter]?.sleep;
    g.actor.position.set(g.player.x,heightAt(g.world,g.player.x,g.player.y)+.015,-g.player.y);
    g.resize();g.notify();
  }

  /* ---- input from the overlay ---- */
  chargeStart(){if(this.phase!=='cast')return;this.phase='charging';this.t=0;this.power=0;this.message='Let go to cast!';this.g.notify();}
  chargeEnd(){
    if(this.phase!=='charging')return;
    if(this.g.nutrition&&!this.g.nutrition.check('fish')){this.quit();return;}
    const power=THREE.MathUtils.clamp(this.power,.15,1);this.sweet=power>=SWEET_SPOT[0]&&power<=SWEET_SPOT[1];
    this.castFrom=this.rodTip();this.landingPoint=this.stand.clone().addScaledVector(this.dir,1.6+power*5.2).add(V(-this.dir.z,0,this.dir.x).multiplyScalar((Math.random()-.5)*1.2)).setY(this.waterY+.03);
    this.phase='flying';this.t=0;this.flight=.75+power*.4;this.bobber.visible=true;this.line.visible=true;this.message=this.sweet?'Sweet spot! Perfect cast!':'Nice cast!';this.g.status='Watching the bobber…';this.g.notify();
  }
  /** Reel handle turned by `delta` radians (clockwise positive). */
  reel(delta){
    if(delta<=0)return;const turns=delta/(Math.PI*2);this.turns+=turns;this.reelMesh.rotation.x-=delta;if(this.spoolMesh)this.spoolMesh.rotation.y+=delta*.6;
    if(this.phase==='bite'){this.hook();return;}
    if(this.phase!=='reel')return;
    if(this.struggling)this.tension=Math.min(1.2,this.tension+turns*TENSION_PER_TURN);
    else this.progress=Math.min(1,this.progress+turns*REEL_PER_TURN);
    this.g.notify();
  }
  hook(){
    this.phase='reel';this.t=0;this.progress=.12;this.tension=0;this.struggling=false;this.nextStruggle=1.1+Math.random()*1.3;this.strength=.7+Math.random()*.6;
    this.message='Hooked! Turn the reel.';this.g.status='Reeling in a fish…';this.shake=.25;this.g.notify();
  }

  rodTip(){this.rod.updateMatrixWorld(true);return this.rod.localToWorld(V(0,this.rodTipY??1.9,0));}

  /* ---- per-frame ---- */
  update(dt){
    if(!this.active)return;const g=this.g;this.t+=dt;
    if(this.fadeDir)this.fade=THREE.MathUtils.clamp(this.fade+dt*this.fadeDir*2.6,0,1);
    if(this.shake>0)this.shake=Math.max(0,this.shake-dt);
    if(this.phase==='arrive'){this.standActor();if(this.fade>=1){this.firstPerson=true;g.actor.visible=false;g.resize();this.fadeDir=-1;this.phase='cast';this.t=0;this.rod.visible=true;this.message=this.caught?'Cast again!':'Hold the button to power up, let go to cast.';this.g.status='Ready to cast…';g.notify();}return;}
    if(this.phase==='leaving'){if(this.fade>=1){const a=this.a;this.leave();if(a){a.cancelled=true;a.duration=0;}this.g.status=`${this.name()} caught ${this.caught} fish. Grill them on a campfire!`;g.finishAction();}return;}
    if(this.fadeDir<0&&this.fade<=0)this.fadeDir=0;
    const idleEnd=()=>this.stand.clone().addScaledVector(this.dir,2.6).setY(this.waterY+.03);
    if(this.phase==='charging'){const k=(this.t%CAST_CYCLE)/CAST_CYCLE;this.power=Math.sin(k*Math.PI);}
    if(this.phase==='flying'){const k=ease(this.t/this.flight);const p=this.castFrom.clone().lerp(this.landingPoint,k);p.y+=Math.sin(k*Math.PI)*1.6;this.bobber.position.copy(p);if(k>=1){this.phase='wait';this.t=0;this.biteAt=this.sweet?.8+Math.random()*1.4:1.4+Math.random()*3.2;this.splash(this.landingPoint,.5);this.message='Wait for the bobber to dip…';g.notify();}}
    if(this.phase==='wait'){this.bobber.position.copy(this.landingPoint);this.bobber.position.y=this.waterY+.03+Math.sin(this.t*2.4)*.03;if(this.t>=this.biteAt){this.phase='bite';this.t=0;this.bites++;this.splash(this.landingPoint,.9);this.shake=.35;this.message='A bite! Turn the reel!';g.notify();}}
    if(this.phase==='bite'){this.bobber.position.copy(this.landingPoint);this.bobber.position.y=this.waterY-.12+Math.abs(Math.sin(this.t*12))*.12;if(this.t>=BITE_WINDOW){this.escape('It got away. Cast again!');}}
    if(this.phase==='reel'){
      if(this.struggling){this.struggleLeft-=dt;this.progress=Math.max(0,this.progress-dt*.045*this.strength);if(this.struggleLeft<=0){this.struggling=false;this.nextStruggle=1.4+Math.random()*1.8;this.message='It calmed down. Reel!';g.notify();}}
      else{this.tension=Math.max(0,this.tension-dt*.55);this.nextStruggle-=dt;if(this.nextStruggle<=0&&this.progress<.95){this.struggling=true;this.struggleLeft=.9+Math.random()*.8*this.strength;this.message='It’s pulling! Hold steady…';this.shake=.2;g.notify();}}
      if(this.tension>=1){this.escape('Snap! The line broke. Cast again!');}
      else if(this.progress>=1){this.phase='landing';this.t=0;this.fish.visible=true;this.fishFrom=this.bobber.position.clone();this.bobber.visible=false;this.message='';this.landFish();}
      else{const k=this.progress;const p=this.landingPoint.clone().lerp(idleEnd(),Math.min(1,k*1.1));p.y=this.waterY+.02+Math.sin(this.t*10)*.05*(this.struggling?2:1);this.bobber.position.copy(p);}
    }
    if(this.phase==='landing'){const k=ease(this.t/1.1),to=this.eye.clone().addScaledVector(this.dir,.75).add(V(0,-.25,0));const p=this.fishFrom.clone().lerp(to,k);p.y+=Math.sin(k*Math.PI)*1.3;this.fish.position.copy(p);this.fish.rotation.set(0,this.t*3,.3*Math.sin(this.t*9));this.fish.scale.setScalar(1.3);
      if(this.t>=1.1&&!this.landed){this.landed=true;this.phase='caught';this.t=0;g.notify();}}
    if(this.phase==='caught'){this.fish.rotation.y+=dt*2;if(this.t>=1.5){this.landed=false;this.fish.visible=false;if(this.caught>=this.target){this.phase='leaving';this.fadeDir=1;this.fade=0;this.message='';g.notify();}else{this.phase='cast';this.t=0;this.message=`${this.caught} of ${this.target}. Cast again!`;g.notify();}}}
    if(this.phase==='escaped'){this.bobber.visible=false;if(this.t>=1.4){this.phase='cast';this.t=0;this.message='Hold the button to power up, let go to cast.';g.notify();}}
    this.placeCamera();this.placeRod();this.drawLine();
  }
  landFish(){
    const g=this.g,a=this.a;try{const before=g.store.state;g.store.commit({type:'fish',spotId:this.spot.id,actionId:crypto.randomUUID()});if(g.store.state===before)throw Error('That fish slipped off at the dock.');this.caught++;g.toast(`Caught a fish! ${this.caught} of ${this.target}`);g.status='Caught 1 fish · grill it on a campfire';if(a)a.caughtAny=true;}
    catch(e){g.toast(e.message);}
    g.notify();
  }
  escape(message){this.escapes++;this.phase='escaped';this.t=0;this.bobber.visible=false;this.line.visible=false;this.message=message;this.shake=.2;this.g.notify();}
  splash(point,size=1){const g=this.g;for(let i=0;i<9;i++){const o=new THREE.Mesh(g.particleGeometry,g.particleMaterials.water);o.position.copy(point);o.scale.setScalar(size+Math.random()*.6);g.scene.add(o);g.particles.push({mesh:o,life:.7,v:V((Math.random()-.5)*1.4,1+Math.random()*1.4,(Math.random()-.5)*1.4)});}}

  placeCamera(){
    if(!this.firstPerson)return;const c=this.camera,w=this.g.container.clientWidth||800,h=this.g.container.clientHeight||600;c.aspect=w/h;c.updateProjectionMatrix();
    const sh=this.shake>0?(Math.random()-.5)*this.shake*.12:0;
    c.position.copy(this.eye).add(V(sh,0,sh));
    const look=this.phase==='landing'||this.phase==='caught'?this.fish.position.clone():this.phase==='cast'||this.phase==='charging'||this.phase==='escaped'?this.eye.clone().addScaledVector(this.dir,6).add(V(0,-1.45,0)):this.bobber.position.clone().lerp(this.eye.clone().addScaledVector(this.dir,6).add(V(0,-.6,0)),.45);
    c.lookAt(look);
  }
  placeRod(){
    if(!this.firstPerson)return;const c=this.camera;const right=V(1,0,0).applyQuaternion(c.quaternion),forward=V(0,0,-1).applyQuaternion(c.quaternion),up=V(0,1,0).applyQuaternion(c.quaternion);
    const dt=Math.min(.05,(performance.now()-(this.rodClock||performance.now()))/1000);this.rodClock=performance.now();
    const wantCock=this.phase==='charging'?1:0;this.cock=THREE.MathUtils.lerp(this.cock||0,wantCock,1-Math.exp(-dt*9));
    const swing=this.phase==='flying'?Math.sin(Math.min(1,this.t/.35)*Math.PI)*.5:0;
    const base=c.position.clone().addScaledVector(right,.34).addScaledVector(up,-.58+this.cock*.06).addScaledVector(forward,.85);
    this.rod.position.copy(base);
    const aim=forward.clone().multiplyScalar(1).addScaledVector(up,.75-this.cock*.55+swing*.9).addScaledVector(right,-.12).normalize();
    this.rod.quaternion.setFromUnitVectors(V(0,1,0),aim);
    if(this.struggling)this.rod.rotateZ(Math.sin(performance.now()*.03)*.04);
  }
  drawLine(){
    if(!this.line.visible||!this.firstPerson)return;const tip=this.rodTip(),end=this.phase==='landing'?this.fish.position.clone():this.bobber.position.clone();
    const mid=tip.clone().lerp(end,.5);mid.y-=this.phase==='reel'?.1:.5;const arr=this.line.geometry.attributes.position;
    for(let i=0;i<=21;i++){const k=i/21,p=tip.clone().multiplyScalar((1-k)**2).addScaledVector(mid,2*(1-k)*k).addScaledVector(end,k*k);arr.setXYZ(i,p.x,p.y,p.z);}arr.needsUpdate=true;this.line.geometry.computeBoundingSphere();
  }

  /** True when the ray hits the spare rod at the dock edge. */
  pickPole(ray){return !!(this.poleHit&&ray.intersectObject(this.poleHit,false).length);}
  /** A tapped point on the visible planks, in gameplay X/Y coordinates. */
  walkPoint(ray){const hit=this.dock&&ray.intersectObject(this.dock,true)[0];return hit?{x:hit.point.x,y:-hit.point.z}:null;}
  /** Screen position for the "Fish?" bubble when the character is standing near the rod. */
  prompt(){
    const g=this.g;if(!this.pole||this.active||!g.loaded||g.overview||g.mapOnly||g.action||g.order)return null;
    const d=Math.hypot(g.player.x-this.polePoint.x,g.player.y-this.polePoint.y);if(d>2.6)return null;
    const rect=g.renderer.domElement.getBoundingClientRect();if(!rect.width)return null;
    g.camera.updateMatrixWorld(true);const p=this.pole.position.clone().add(V(0,1.9,0)).project(g.camera);
    return {x:(p.x+1)*rect.width/2,y:(1-p.y)*rect.height/2,near:d<1.4};
  }
  snapshot(){
    if(!this.active)return null;
    return {phase:this.phase,firstPerson:this.firstPerson,fade:this.fade,message:this.message,power:this.power,progress:this.progress,tension:Math.min(1,this.tension),struggling:this.struggling,caught:this.caught,target:this.target,name:this.name()};
  }
}
