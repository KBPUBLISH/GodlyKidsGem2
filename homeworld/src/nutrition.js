import * as THREE from 'three';
import {dist,heightAt,cellFromKey,growth,gameTime} from './core.mjs';
import {prayGain,prayerWait,prayerFor,PRAY_GAIN,FOODS,FOOD_RECIPES,RECIPES,CRAFT_RECIPES,WATER_MAX,MAX_ENERGY,activeCharacter,energyFor,energyCost,canAffordEnergy,canCook,restGain,isLowEnergy,completedHomes,sleepHome,homeName,canSleep,sleepProgress,SLEEP_SECONDS,MAX_HUNGER,hungerFor,isHungry,isStarving,workRate,needsFood,mealGain} from './nutrition.mjs';
import {homeReserved} from './community.mjs';
import {workPoint,footprint,buildingById,completedFires,litFires,firesNeedingLog,fireFuelLeft,fireCanTakeLog,FIRE_LOW_MINUTES,heatSources,completedOvens,hotOvens,ovenWarmth,OVEN_WARMUP_MINUTES,logMinutesFor} from './building.mjs';
import {completedWells} from './digging.mjs';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion();
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const position=p=>V(p[0],p[2],-p[1]);
const material=color=>new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true});
function mesh(geometry,mat,group,xyz=[0,0,0]){const o=new THREE.Mesh(geometry,mat);o.position.set(...xyz);o.castShadow=true;group.add(o);return o;}
export function fishModel(cooked=false){
  const g=new THREE.Group(),skin=material(cooked?'#b88247':'#6ca9ac'),fin=material(cooked?'#a16b37':'#467b84');
  const body=mesh(new THREE.IcosahedronGeometry(.13,1),skin,g);body.scale.set(1.8,.8,.62);
  const tail=mesh(new THREE.ConeGeometry(.105,.16,3),fin,g,[-.28,0,0]);tail.rotation.z=Math.PI/2;
  const top=mesh(new THREE.ConeGeometry(.06,.09,3),fin,g,[-.04,.09,0]);top.rotation.z=.3;
  for(const z of [-.078,.078]){mesh(new THREE.SphereGeometry(.022,8,6),material('#faf2d2'),g,[.14,.025,z]);mesh(new THREE.SphereGeometry(.011,8,6),material('#283d37'),g,[.151,.026,z*1.12]);}
  if(cooked)for(const x of [-.08,0,.08])mesh(new THREE.BoxGeometry(.015,.025,.13),fin,g,[x,.10,0]);
  return g;
}
function appleModel(){const g=new THREE.Group();mesh(new THREE.SphereGeometry(.09,12,10),material('#d93a2f'),g);mesh(new THREE.CylinderGeometry(.008,.01,.05,6),material('#5a3b1e'),g,[0,.1,0]);const leaf=mesh(new THREE.SphereGeometry(.03,8,6),material('#5aa33a'),g,[.025,.1,0]);leaf.scale.set(1.4,.4,.8);return g;}
function brickModel(){const g=new THREE.Group();for(const [x,y] of [[-.07,0],[.07,0],[0,.075]])mesh(new THREE.BoxGeometry(.13,.07,.09),material(y?'#b5704a':'#a3623f'),g,[x,y,0]);return g;}
function breadModel(){const g=new THREE.Group(),loaf=mesh(new THREE.IcosahedronGeometry(.17,1),material('#d4a45b'),g);loaf.scale.set(1,.60,.72);for(const x of [-.08,0,.08])mesh(new THREE.BoxGeometry(.018,.018,.12),material('#f2d99a'),g,[x,.095,0]);return g;}

export class Nutrition {
  constructor(game){
    this.g=game;this.held=null;this.fish=fishModel();this.fish.visible=false;game.scene.add(this.fish);
    this.rod=new THREE.Group();const wood=material('#927247'),tipMat=material('#b7a66e');
    mesh(new THREE.CylinderGeometry(.028,.034,.35,8),wood,this.rod,[0,.10,0]);mesh(new THREE.CylinderGeometry(.009,.023,1.8,8),tipMat,this.rod,[0,1.17,0]);
    const reel=mesh(new THREE.TorusGeometry(.075,.015,6,12),material('#7d8881'),this.rod,[.06,.28,0]);reel.rotation.y=Math.PI/2;this.rod.visible=false;game.scene.add(this.rod);
    this.bobber=new THREE.Group();mesh(new THREE.SphereGeometry(.065,10,8),material('#e66f47'),this.bobber,[0,.025,0]);mesh(new THREE.CylinderGeometry(.055,.055,.045,10),material('#fff4d8'),this.bobber,[0,-.008,0]);this.bobber.visible=false;game.scene.add(this.bobber);
    this.line=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(63),3)),new THREE.LineBasicMaterial({color:'#f7ecd0',transparent:true,opacity:.85}));this.line.visible=false;game.scene.add(this.line);
    this.ripple=new THREE.Mesh(new THREE.RingGeometry(.15,.18,32),new THREE.MeshBasicMaterial({color:'#c7f0eb',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));this.ripple.rotation.x=-Math.PI/2;game.scene.add(this.ripple);
    this.spot=game.world.fishingSpots?.[0];if(this.spot)this.ripple.position.copy(position(this.spot.water)).add(V(0,.025,0));else this.ripple.visible=false;
  }
  check(action){
    const s=this.g.store.state,name=s.characters?.[activeCharacter(s)]?.name||'Adam';
    if(canAffordEnergy(s,action))return true;
    const cost=energyCost(s,action);
    this.g.status=`${name} needs ${cost} energy. Go home to sleep, eat some food, or take a breather.`;this.g.toast(this.g.status);return false;
  }
  busy(){if(this.g.ambientNudge?.())return true;if(this.g.action||this.g.order||this.sleep){this.g.toast('Let your character finish this action first.');return true;}return false;}
  eat(item){const g=this.g;if(this.busy())return;const food=FOODS[item];if(!food||!(g.store.state.inventory[item]>0)){g.toast('Gather or prepare that food first.');return;}if(mealGain(g.store.state,item,gameTime(g.store.state)).total<=0){g.toast(`${g.store.state.characters?.[activeCharacter(g.store.state)]?.name||'Adam'} is full. Save this food for later.`);return;}g.startAction({type:'eat',item,actionId:crypto.randomUUID(),target:{...g.player}});}
  /** Walk to a campfire and drop a log on it (one log = 2 island hours). */
  stokeFire(fireId){
    const g=this.g;if(this.busy())return;
    const s=g.store.state,fire=heatSources(s).find(b=>b.id===fireId);if(!fire)return;const what=fire.kind==='oven'?'oven':'campfire';
    if(!Object.entries(s.inventory).some(([id,n])=>id.endsWith('_wood')&&n>0)){g.toast('No logs in the bag. Chop a tree first.');return;}
    const spot=workPoint(g.world,fire);
    if(dist(g.player,spot)<=1.35){this.commitStoke(fireId);return;}
    const path=g.nav.path(g.player,spot);if(!path||dist(path.at(-1)||g.player,spot)>1.05){g.toast(`The way to the ${what} is blocked. Clear a path first.`);return;}
    g.keys.clear();g.lastGroundKey=null;g.path=path;g.order={type:'stoke',fireId,target:spot};
    g.marker.position.set(spot.x,heightAt(g.world,spot.x,spot.y)+.04,-spot.y);g.marker.visible=true;g.status=`Carrying a log to the ${what}…`;g.notify();
  }
  commitStoke(fireId){
    const g=this.g;try{const before=g.store.state;g.store.persistPlayer(g.player);g.store.commit({type:'stoke',fireId,actionId:crypto.randomUUID()});if(g.store.state===before){g.toast('The fire is already stacked high.');return false;}
      const fire=heatSources(g.store.state).find(b=>b.id===fireId),left=fireFuelLeft(fire,gameTime(g.store.state));g.burst(workPoint(g.world,fire),'wood',.2);g.status=fire.kind==='oven'?(ovenWarmth(fire,gameTime(g.store.state))<1?'Log added · the oven is heating up':`Log added · the oven stays hot for ${Math.round(left/60*10)/10} hours`):`Log added · the fire will burn for ${Math.round(left/60*10)/10} hours`;g.toast(g.status);g.notify();return true;}
    catch(e){g.toast(e.message);return false;}
  }
  /** Screen anchors for campfires that are out or burning low, so one tap sends a log over. */
  firePrompts(){
    const g=this.g;if(!g.loaded||g.overview||g.mapOnly||g.action)return [];
    const s=g.store.state,min=gameTime(s),rect=g.renderer.domElement.getBoundingClientRect();if(!rect.width)return [];
    g.camera.updateMatrixWorld(true);const out=[];
    for(const fire of firesNeedingLog(s,min)){const fp=footprint(g.world,fire),c=fp.center,pr=new THREE.Vector3(c.x,heightAt(g.world,c.x,c.y)+1.6,-c.y).project(g.camera);if(Math.abs(pr.x)>.95||Math.abs(pr.y)>.9)continue;out.push({id:fire.id,out:fireFuelLeft(fire,min)<=0,minutes:Math.round(fireFuelLeft(fire,min)),x:(pr.x+1)*rect.width/2,y:(1-pr.y)*rect.height/2});}
    return out;
  }
  commitCook(recipe,fireId){
    const g=this.g;
    try{
      g.store.persistPlayer(g.player);
      const before=g.store.state;
      g.store.commit({type:'cook',recipe,fireId,actionId:crypto.randomUUID()});
      const r=RECIPES[recipe];if(g.store.state===before){g.toast(r?.station==='oven'?'Stand beside a hot oven to bake.':'Stand beside a lit campfire.');return false;}
      g.status=FOODS[r.item]?`${FOODS[r.item].name} ${r.station==='oven'?'baked':'prepared'} · ready to eat`:`+${r.quantity} clay brick · ${g.store.state.inventory.clay||0} in the bag`;g.toast(g.status);g.notify();return true;
    }catch(e){g.toast(e.message);return false;}
  }
  cook(recipe){
    const g=this.g;if(this.busy())return;
    const r=RECIPES[recipe];if(!r)return;
    if(!canCook(g.store.state,recipe)){g.toast(recipe==='bake_manna'?'Manna needs 1 wheat and 1 water. Harvest wheat and fill a bucket at the well.':recipe==='dry_clay'?'Clay needs 2 mud and 1 water. Dig mud at the beach and fetch water from the well.':'Gather the ingredients first.');return;}
    const min=gameTime(g.store.state),oven=r.station==='oven',fires=oven?hotOvens(g.store.state,min):litFires(g.store.state,min);
    if(!fires.length){
      if(oven){const built=completedOvens(g.store.state);g.toast(!built.length?'Build a clay oven before you can bake manna.':built.some(b=>fireFuelLeft(b,min)>0)?'The oven is still heating up. Give it a moment.':'The oven is cold. Tap it to add a log.');return;}
      g.toast(completedFires(g.store.state).length?'The campfire is out. Tap the fire to add a log.':`Build a campfire before you can ${recipe==='dry_clay'?'dry clay':'grill a fish'}.`);return;
    }
    const spots=fires.map(fire=>({fire,spot:workPoint(g.world,fire)})).sort((a,b)=>dist(g.player,a.spot)-dist(g.player,b.spot));
    for(const {fire,spot} of spots){
      const center=footprint(g.world,fire).center;
      if(dist(g.player,spot)<=1.35){g.startAction({type:'grill',recipe,fireId:fire.id,target:center});return;}
      const path=g.nav.path(g.player,spot);if(!path||dist(path.at(-1)||g.player,spot)>1.05)continue;
      g.keys.clear();g.lastGroundKey=null;g.path=path;g.order={type:'grill',recipe,fireId:fire.id,target:center};
      g.marker.position.set(spot.x,heightAt(g.world,spot.x,spot.y)+.04,-spot.y);g.marker.visible=true;g.status=oven?'Walking to the oven to bake…':'Walking to the campfire…';g.notify();return;
    }
    g.toast(`The way to the ${oven?'oven':'campfire'} is blocked. Clear a path first.`);
  }
  /** Walk to the well and fill a bucket (water is used for clay and manna). */
  fetchWater(wellId){
    const g=this.g;if(this.busy())return;
    const s=g.store.state,well=completedWells(s).find(b=>b.id===wellId)||completedWells(s)[0];if(!well){g.toast('Build a water well first.');return;}
    if((s.inventory.water||0)>=WATER_MAX){g.toast(`The bag already holds ${WATER_MAX} buckets of water.`);return;}
    const spot=workPoint(g.world,well);
    if(dist(g.player,spot)<=1.35){this.commitFetchWater(well.id);return;}
    const path=g.nav.path(g.player,spot);if(!path||dist(path.at(-1)||g.player,spot)>1.05){g.toast('The way to the well is blocked. Clear a path first.');return;}
    g.keys.clear();g.lastGroundKey=null;g.path=path;g.order={type:'fetch_water',wellId:well.id,target:spot};
    g.marker.position.set(spot.x,heightAt(g.world,spot.x,spot.y)+.04,-spot.y);g.marker.visible=true;g.status='Walking to the well…';g.notify();
  }
  commitFetchWater(wellId){
    const g=this.g;try{const before=g.store.state;g.store.persistPlayer(g.player);g.store.commit({type:'fetch_water',wellId,actionId:crypto.randomUUID()});if(g.store.state===before){g.toast('The bucket could not be filled here.');return false;}
      const well=completedWells(g.store.state).find(b=>b.id===wellId);if(well)this.splash(V(workPoint(g.world,well).x,heightAt(g.world,workPoint(g.world,well).x,workPoint(g.world,well).y)+.9,-workPoint(g.world,well).y));g.status=`Bucket filled · ${g.store.state.inventory.water||0} water in the bag`;g.toast(g.status);g.notify();return true;}
    catch(e){g.toast(e.message);return false;}
  }
  /** Kneel for a short prayer. The words show in a bubble (and are read aloud when the browser can), then energy lifts by PRAY_GAIN. */
  pray(){
    const g=this.g;if(this.busy())return false;const s=g.store.state,minutes=gameTime(s),wait=prayerWait(s,minutes);
    if(wait>0){g.toast(`${s.characters[s.activeCharacter]?.name||'Your friend'} just prayed. Pray again in about ${Math.max(1,Math.ceil(wait*25/60))} seconds, or keep working and come back.`);return false;}
    const prayer=prayerFor(s);
    const actionId=crypto.randomUUID(),home=g.actor?.userData,parent=window.parent&&window.parent!==window?window.parent:null;
    g.startAction({type:'pray',actionId,target:{...g.player},prayer});
    if(g.action?.type!=='pray')return false;
    g.prayer={text:prayer.text,verse:prayer.verse,name:s.characters[s.activeCharacter]?.name||'Friend',actor:g.actor,until:performance.now()+16000};
    // The character's own ElevenLabs voice lives in the parent app (it knows each story friend's voiceId); the island only asks and listens.
    if(parent&&home?.residentId){
      this.voice={id:actionId,status:'pending',since:performance.now(),text:prayer.text};
      parent.postMessage({type:'gk-resident-pray',id:actionId,character:{id:home.residentId,name:home.name||'',imageUrl:home.imageUrl||''},text:prayer.text,tts:prayer.tts||prayer.text},location.origin);
    }else{this.voice=null;this.speakPrayer(prayer.text);}
    return true;
  }
  /** Parent app reports on the prayer audio: playing (with its length), ended, or failed (then the browser voice steps in). */
  onPrayerVoice(msg){
    const v=this.voice,a=this.g.action;if(!v||!msg||msg.id!==v.id)return;
    if(msg.status==='playing'){v.status='playing';const d=Number(msg.duration);if(a?.type==='pray'&&a.actionId===v.id&&Number.isFinite(d)&&d>0)a.duration=Math.max(a.duration,Math.min(45,a.t+d+1.2));}
    else if(msg.status==='ended'){v.status='ended';if(a?.type==='pray'&&a.actionId===v.id)a.duration=Math.max(4,Math.min(a.duration,a.t+1));}
    else if(msg.status==='failed'&&v.status!=='local'){v.status='local';this.speakPrayer(v.text);}
  }
  speakPrayer(text){
    try{
      const synth=window.speechSynthesis;if(!synth||typeof SpeechSynthesisUtterance==='undefined')return;
      synth.cancel();this.speaking=true;const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.pitch=1.08;u.onend=u.onerror=()=>{this.speaking=false;};
      const voices=synth.getVoices?.()||[],pick=voices.find(v=>/en/i.test(v.lang)&&/(samantha|karen|moira|female|zira|google us english)/i.test(v.name))||voices.find(v=>/^en/i.test(v.lang));if(pick)u.voice=pick;
      synth.speak(u);
    }catch{/* speech is a bonus, never a blocker */}
  }
  rest(){const g=this.g;if(this.busy())return;if(!restGain(g.store.state)){g.toast('A breather restores energy up to 25. Eat a meal for a fuller refill.');return;}g.startAction({type:'rest',actionId:crypto.randomUUID(),target:{...g.player}});}
  /** How fast the active character works right now (hunger slows, energy is the only stop). */
  workRate(){const s=this.g.store?.state;return s?workRate(s,gameTime(s)):1;}
  get sleep(){const s=this.g.store.state;return s.characters[activeCharacter(s)]?.sleep;}
  goSleep(homeId){
    const g=this.g;if(this.sleep){this.resumeSleep();return false;}if(this.busy())return false;
    if(!canSleep(g.store.state,gameTime(g.store.state))){g.toast('Energy is already full!');return false;}
    if(homeId&&homeReserved(g.store.state,homeId)){g.toast('A friend is resting there. Choose another home or wait until they wake up.');return false;}
    const homes=completedHomes(g.store.state).filter(h=>(!homeId||h.id===homeId)&&!homeReserved(g.store.state,h.id)).sort((a,b)=>dist(g.player,workPoint(g.world,a))-dist(g.player,workPoint(g.world,b)));
    for(const home of homes){
      const door=workPoint(g.world,home),path=g.nav.path(g.player,door);if(!path||dist(path.at(-1)||g.player,door)>1.05)continue;
      g.keys.clear();g.lastGroundKey=null;g.path=path;g.order={type:'sleep',homeId:home.id,sleepId:crypto.randomUUID(),target:door};
      g.marker.position.set(door.x,heightAt(g.world,door.x,door.y)+.04,-door.y);g.marker.visible=true;g.status=`Walking home to sleep in the ${homeName(home).toLowerCase()}…`;g.notify();return true;
    }
    g.toast(homes.length?'The way home is blocked. Clear a path to the front door.':completedHomes(g.store.state).length?'Your friends are using the homes. Wait until one is free.':'Build a Small Hut or Prayer Tent so there is a home to sleep in.');return false;
  }
  resumeSleep(){
    const g=this.g,sleep=this.sleep;if(!sleep||g.action||g.order||this.sleepSaveError===sleep.id)return;
    if(!sleepHome(g.store.state,sleep.homeId)){this.wakeUp();return;}
    g.keys.clear();g.path=[];g.action={type:'sleep',homeId:sleep.homeId,sleepId:sleep.id,t:0};this.begin(g.action);g.notify();
  }
  wakeUp(){
    const g=this.g,sleep=this.sleep;if(!sleep)return;
    try{g.store.commit({type:'cancel_sleep',sleepId:sleep.id,actionId:`cancel:${sleep.id}`});
      if(this.sleep)return;g.action=null;g.order=null;g.path=[];this.sleepSaveError=null;this.clear();g.persist();g.toast('Awake again. A full rest restores energy.');g.notify();
    }catch(e){g.toast(e.message);}
  }
  retrySleep(){this.sleepSaveError=null;this.resumeSleep();}
  harvestFood(){
    const g=this.g;if(this.busy())return;const candidates=Object.entries(g.store.state.cells).filter(([,c])=>{const p=growth(c,gameTime(g.store.state));return p?.stage==='ready'&&['carrot','pumpkin','wheat'].includes(p.seed.plant);}).map(([key])=>cellFromKey(g.world,key)).sort((a,b)=>dist(a,g.player)-dist(b,g.player));
    if(!candidates.length){g.toast('No garden food is ready yet. Plant carrots or pumpkins, or catch a fish at the shore.');return;}g.gardenAction('harvest',candidates[0].key);
  }
  goFish(){
    const g=this.g;if(this.busy()||!this.check('fish'))return;const spot=this.spot;if(!spot){g.toast('The fishing spot could not be found.');return;}
    const land={x:spot.position[0],y:spot.position[1]},path=g.nav.path(g.player,land);if(!path){g.toast('The way to the dock is blocked. Clear a path first.');return;}
    g.tool='fish';g.path=path;g.order={type:'fish',spotId:spot.id,actionId:crypto.randomUUID(),target:{x:spot.water[0],y:spot.water[1]}};g.marker.position.copy(position(spot.position)).add(V(0,.04,0));g.marker.visible=true;g.status='Walking to the dock…';g.notify();
  }
  begin(a){
    this.clear();a.duration=a.type==='fish'?4.8:a.type==='rest'?8:a.type==='pray'?9:1.5;
    if(a.type==='sleep'){
      try{
        if(!this.sleep)this.g.store.commit({type:'begin_sleep',homeId:a.homeId,actionId:a.sleepId});
        const sleep=this.sleep;if(!sleep||sleep.id!==a.sleepId)throw Error('Walk to the front of a completed home to sleep.');
        a.startedAt=sleep.startedAt;a.duration=SLEEP_SECONDS;this.sleepVisualActive=true;this.g.actor.visible=false;this.g.status='Sleeping at home…';
      }catch(e){a.failed=true;a.duration=0;this.g.toast(e.message);}
    }else if(a.type==='eat'){
      this.held=a.item==='cooked_fish'?fishModel(true):a.item==='bread'||a.item==='manna'?breadModel():a.item==='apple'?appleModel():this.g.asset(`produce_${a.item}`);
      if(['carrot','pumpkin'].includes(a.item))this.held.scale.setScalar(a.item==='pumpkin'?.28:.55);this.g.scene.add(this.held);this.g.status=`Eating ${FOODS[a.item].name.toLowerCase()}…`;
    }else if(a.type==='grill'&&a.recipe!=='grill_fish'){
      const r=RECIPES[a.recipe];a.duration=r?.seconds||4;this.held=a.recipe==='dry_clay'?brickModel():breadModel();this.g.scene.add(this.held);this.g.status=a.recipe==='dry_clay'?'Drying clay bricks by the fire…':'Baking manna in the oven…';a.smokeAt=0;
    }else if(a.type==='grill'){
      a.duration=3.4;const stick=new THREE.Group(),rod=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,.95,6),new THREE.MeshStandardMaterial({color:'#8a5a2b',roughness:1}));rod.rotation.z=Math.PI/2;rod.position.x=.42;stick.add(rod);
      const fish=fishModel(false);fish.position.set(.86,.02,0);fish.rotation.z=-.15;stick.add(fish);stick.userData.fish=fish;stick.userData.skins=[];fish.traverse(o=>{if(o.isMesh&&o.material&&!o.material.userData?.locked){o.material=o.material.clone();stick.userData.skins.push({m:o.material,from:o.material.color.clone()});}});
      this.held=stick;this.g.scene.add(stick);this.g.status='Grilling a fish over the fire…';a.smokeAt=0;
    }else if(a.type==='fish'){const task=this.g.autoWork?.task;a.duration=Infinity;this.g.fishing.enter(a,task?.type==='fish'?Math.max(1,task.target-task.done):1);}
    else this.g.status='Taking a breather…';
  }
  /** Kneeling prayer pose: hips sink, shins fold back under, head bows and hands clasp at the chest. `k` blends 0→1. */
  kneel(k,t){
    const g=this.g,b=g.bones;if(!b.mixamorigHips)return;const e=k*k*(3-2*k);
    b.mixamorigHips.position.y-=.47*e;
    for(const side of ['Left','Right']){b[`mixamorig${side}UpLeg`]?.rotateX(-.08*e);b[`mixamorig${side}Leg`]?.rotateX(2.25*e);b[`mixamorig${side}Foot`]?.rotateX(.9*e);}
    b.mixamorigSpine?.rotateX((.16+Math.sin(t*1.2)*.02)*e);b.mixamorigHead?.rotateX(.42*e);g.actor.updateMatrixWorld(true);
    const y=1.08-.47*e,z=.22+.04*e;this.poseHands([-.045,y,z],[.045,y,z]);
  }
  poseHands(right,left){const g=this.g;g.ik('Right',g.localPoint(right));g.ik('Left',g.localPoint(left));g.actor.updateMatrixWorld(true);return g.bones.mixamorigRightHand.localToWorld(V(0,.065,0));}
  animate(dt){
    const g=this.g,a=g.action;
    if(a.type==='fish'){if(a.failed){g.finishAction();return;}g.fishing.update(dt);return;}
    if(a.type==='sleep'){
      if(a.failed){g.finishAction();return;}
      a.t=Math.max(0,(Date.now()-a.startedAt)/1000);g.status=`Sleeping at home · ${Math.max(0,Math.ceil(a.duration-a.t))}s`;
      if(a.t>=a.duration)g.finishAction();return;
    }
    a.t+=dt*(a.type==='fish'?this.workRate():1);const t=a.t;
    if(a.type==='eat'){
      const p=Math.sin(Math.PI*Math.min(1,t/a.duration)),w=[-.30,1.08+.82*ease(p),.17+.11*ease(p)],grip=this.poseHands(w,[.36,1.1,.12]);this.held.position.copy(grip);this.held.quaternion.copy(g.bones.mixamorigRightHand.getWorldQuaternion(Q()));this.held.rotateZ(-.5);
    }else if(a.type==='grill'){
      const k=Math.min(1,t/a.duration),bob=Math.sin(t*2.6)*.03,grip=this.poseHands([-.12,1.02+bob,.38],[.14,1.0+bob,.34]);
      const fireNode=heatSources(g.store.state).find(b=>b.id===a.fireId),fc=fireNode?footprint(g.world,fireNode).center:a.target,aim=V(fc.x,heightAt(g.world,fc.x,fc.y)+.62+Math.sin(t*2.1)*.04,-fc.y);this.held.position.copy(grip);this.held.quaternion.setFromUnitVectors(V(1,0,0),aim.sub(grip).normalize());this.held.rotateX(Math.sin(t*1.3)*.25);
      const cookedSkin=new THREE.Color('#b88247'),cookedFin=new THREE.Color('#a16b37');for(const s of this.held.userData.skins||[]){const target=s.from.getHex()===0x6ca9ac?cookedSkin:s.from.getHex()===0x467b84?cookedFin:null;if(target)s.m.color.copy(s.from).lerp(target,ease(k));}
      if(t>a.smokeAt){a.smokeAt=t+.22;const c=fc;const base=V(c.x,heightAt(g.world,c.x,c.y)+.55,-c.y);for(let i=0;i<2;i++){const o=new THREE.Mesh(g.particleGeometry,g.particleMaterials[i?'ember':'smoke']);o.position.copy(base).add(V((Math.random()-.5)*.3,Math.random()*.2,(Math.random()-.5)*.3));o.scale.setScalar(i?.5:1.1+Math.random());g.scene.add(o);g.particles.push({mesh:o,life:i?.5:1.1,v:V((Math.random()-.5)*.3,i?1.6:.9+Math.random()*.4,(Math.random()-.5)*.3)});}}
      g.status=a.recipe==='dry_clay'?(k<.5?'Drying clay bricks by the fire…':'Almost dry!'):a.recipe==='bake_manna'?(k<.4?'Manna is in the oven…':k<.85?'Smells wonderful…':'Almost done!'):k<.35?'Holding the fish over the flames…':k<.8?'Sizzling…':'Almost done!';
    }else if(a.type==='rest'){
      this.poseHands([-.34,1.1,.16],[.34,1.1,.16]);g.bones.mixamorigSpine.rotateX(Math.sin(t*1.5)*.025);g.status=`Taking a breather · ${Math.max(1,Math.ceil(a.duration-t))}s`;
    }else if(a.type==='pray'){
      const v=this.voice;if(v&&v.id===a.actionId){if(v.status==='pending'&&performance.now()-v.since>4000){v.status='local';this.speakPrayer(v.text);}if(v.status==='playing')a.duration=Math.max(a.duration,Math.min(45,t+1.2));}
      this.kneel(Math.min(1,t/.9)*(t>a.duration-.8?Math.max(0,(a.duration-t)/.8):1),t);g.status=t<.9?'Kneeling down to pray…':t>a.duration-.8?'Amen.':'Praying…';
    }else this.animateFishing(a);
    if(t>=a.duration)g.finishAction();
  }
  animateFishing(a){
    const g=this.g,t=a.t,cast=ease((t-.45)/.9),reel=ease((t-3.15)/1.45);
    const right=t<1.2?[-.28,1.55+.30*Math.sin(cast*Math.PI),.15+.30*cast]:[-.23,1.38+.23*reel,.43-.15*reel];
    const grip=this.poseHands(right,[.22,1.34+.1*reel,.3]);this.rod.position.copy(grip);
    const direction=g.localPoint([0,1.9+reel*.65,1.7-reel*.55]).sub(grip).normalize();this.rod.quaternion.setFromUnitVectors(V(0,1,0),direction);this.rod.updateMatrixWorld(true);g.ik('Left',this.rod.localToWorld(V(.03,.16,0)));
    const tip=this.rod.localToWorld(V(0,2.07,0)),water=position(this.spot.water).add(V(0,.04,0));
    let end=water.clone();if(t<1.35){const k=ease((t-.5)/.85);end=tip.clone().lerp(water,k);end.y+=Math.sin(k*Math.PI)*1.1;}else end.y+=Math.sin(t*9)*.025;
    this.bobber.position.copy(end);this.bobber.visible=t<3.65;
    if(t>3.25&&!a.splashed){a.splashed=true;this.splash(water);}
    if(t>3.55){const k=ease((t-3.55)/1.2),hand=g.bones.mixamorigLeftHand.localToWorld(V(0,.065,0));end=water.clone().lerp(hand,k);end.y+=Math.sin(k*Math.PI)*1.1;this.fish.visible=true;this.fish.position.copy(end);this.fish.rotation.set(0,t*2,.25*Math.sin(t*8));}
    const middle=tip.clone().lerp(end,.5);middle.y-=.22*(1-reel);const array=this.line.geometry.attributes.position;
    for(let i=0;i<=20;i++){const k=i/20,p=tip.clone().multiplyScalar((1-k)**2).addScaledVector(middle,2*(1-k)*k).addScaledVector(end,k*k);array.setXYZ(i,p.x,p.y,p.z);}array.needsUpdate=true;this.line.geometry.computeBoundingSphere();
    g.status=t<1.3?'Casting the fishing line…':t<3.25?'Watching the bobber…':'Reeling in a fish…';
  }
  splash(point){const g=this.g;for(let i=0;i<8;i++){const o=new THREE.Mesh(g.particleGeometry,g.particleMaterials.water);o.position.copy(point);g.scene.add(o);g.particles.push({mesh:o,life:.8,v:V((Math.random()-.5),.8+Math.random(),(Math.random()-.5))});}}
  finish(a){
    if(a.type==='fish')return; // the dock game banks each catch as it lands
    if(a.type==='grill'){if(this.commitCook(a.recipe,a.fireId))this.g.burst(a.target,'ember',.7);return;}
    if(a.type==='sleep'){
      if(a.failed)return;const g=this.g,before=g.store.state;
      try{g.store.commit({type:'finish_sleep',sleepId:a.sleepId,actionId:`wake:${a.sleepId}`});
        if(g.store.state===before)throw Error('Sleep could not finish. Your saved energy is safe; try waking again.');
        this.sleepSaveError=null;g.toast('Fully rested! 100 energy and ready to explore.');
      }catch(e){this.sleepSaveError=a.sleepId;g.toast(e.message);}return;
    }
    const g=this.g,before=g.store.state,e=energyFor(before),min=gameTime(before),h=hungerFor(before,min);try{
      g.store.commit(a);if(g.store.state===before){g.status='That action could not be completed. Your food and energy are unchanged.';g.toast(g.status);return;}
      const gain=energyFor(g.store.state)-e,tummy=Math.round(hungerFor(g.store.state,min)-h);
      g.status=a.type==='eat'?`${FOODS[a.item].name} eaten · ${[gain>0?`+${gain} energy`:'',tummy>0?`+${tummy}% tummy`:''].filter(Boolean).join(' · ')||'yum'}`:a.type==='rest'?`Feeling better · +${gain} energy`:a.type==='pray'?`Amen · spirit lifted, +${gain} energy`:'Caught 1 fish · grill it on a campfire';g.toast(g.status);
    }catch(error){g.toast(error.message);}
  }
  /** Stop a prayer mid-sentence (the character was interrupted). A finished prayer is left to end naturally. */
  hushPrayer(){const v=this.voice;this.voice=null;if(v&&window.parent&&window.parent!==window)window.parent.postMessage({type:'gk-prayer-stop',id:v.id},location.origin);if(!this.speaking)return;this.speaking=false;try{window.speechSynthesis?.cancel();}catch{/* best effort */}}
  clear(){if(this.g.fishing?.active)this.g.fishing.leave();if(this.held){this.g.scene.remove(this.held);this.held=null;}if(this.sleepVisualActive){this.g.actor.visible=true;this.sleepVisualActive=false;}this.rod.visible=false;this.bobber.visible=false;this.line.visible=false;this.fish.visible=false;}
  update(){
    const g=this.g;if(this.sleep)this.resumeSleep();else this.sleepSaveError=null;
    const lowEnergy=isLowEnergy(g.store.state);if(lowEnergy!==this.lastLowEnergy){this.lastLowEnergy=lowEnergy;if(lowEnergy&&!this.sleep)g.toast(`${g.store.state.characters[activeCharacter(g.store.state)].name} is low on energy. Have a snack or rest at home.`);}
    const min=gameTime(g.store.state),hungry=isHungry(g.store.state,min),starving=isStarving(g.store.state,min),hungerState=starving?2:hungry?1:0;
    if(hungerState!==this.lastHungerState){const was=this.lastHungerState;this.lastHungerState=hungerState;const who=g.store.state.characters[activeCharacter(g.store.state)].name;if(was!==undefined&&!this.sleep){if(hungerState===2)g.toast(`${who}'s tummy is empty. Work is very slow until ${who} eats!`);else if(hungerState===1&&was===0)g.toast(`${who} is getting hungry and working slower. Pick something from the garden.`);}}
    if(!this.spot)return;this.ripple.visible=dist(g.player,{x:this.spot.position[0],y:this.spot.position[1]})<25;this.ripple.scale.setScalar(.85+.2*Math.sin(performance.now()*.003));
  }
  /** What the campfire popup needs: fuel, raw fish and whether grilling can start now. */
  campfireCard(fireId){
    const g=this.g,s=g.store.state,min=gameTime(s),fire=completedFires(s).find(b=>b.id===fireId)||completedFires(s)[0];if(!fire)return null;
    const left=fireFuelLeft(fire,min),hasWood=Object.entries(s.inventory).some(([id,n])=>id.endsWith('_wood')&&n>0);
    return {id:fire.id,lit:left>0,minutesLeft:Math.round(left),low:left<FIRE_LOW_MINUTES,canStoke:fireCanTakeLog(fire,min),hasWood,rawFish:s.inventory.fish||0,cookedFish:s.inventory.cooked_fish||0,gain:Math.round(mealGain(s,'cooked_fish',min).total),mud:s.inventory.mud||0,water:s.inventory.water||0,clay:s.inventory.clay||0,canDryClay:canCook(s,'dry_clay'),busy:!!(this.g.action||this.g.order||this.sleep)};
  }
  /** What the oven popup needs: heat, fuel, ingredients and whether baking can start now. */
  ovenCard(ovenId){
    const g=this.g,s=g.store.state,min=gameTime(s),oven=completedOvens(s).find(b=>b.id===ovenId)||completedOvens(s)[0];if(!oven)return null;
    const left=fireFuelLeft(oven,min),warmth=ovenWarmth(oven,min),hasWood=Object.entries(s.inventory).some(([id,n])=>id.endsWith('_wood')&&n>0);
    return {id:oven.id,lit:left>0,hot:warmth>=1,warmth,warmSeconds:left>0&&warmth<1?Math.ceil((1-warmth)*OVEN_WARMUP_MINUTES*600000/1440):0,minutesLeft:Math.round(left),canStoke:fireCanTakeLog(oven,min),hasWood,wheat:s.inventory.wheat||0,water:s.inventory.water||0,manna:s.inventory.manna||0,canBake:canCook(s,'bake_manna'),gain:Math.round(mealGain(s,'manna',min).total),hasWell:completedWells(s).length>0,busy:!!(this.g.action||this.g.order||this.sleep)};
  }
  /** What the well popup needs. */
  wellCard(wellId){
    const g=this.g,s=g.store.state,well=completedWells(s).find(b=>b.id===wellId)||completedWells(s)[0];if(!well)return null;
    return {id:well.id,water:s.inventory.water||0,max:WATER_MAX,mud:s.inventory.mud||0,wheat:s.inventory.wheat||0,ovens:completedOvens(s).length,busy:!!(this.g.action||this.g.order||this.sleep)};
  }
  snapshot(){
    const g=this.g,s=g.store.state,id=activeCharacter(s),minutes=gameTime(s),sleep=this.sleep,homes=completedHomes(s),lowEnergy=isLowEnergy(s);
    let sleeping=null;if(sleep){
      const home=sleepHome(s,sleep.homeId),p=home?footprint(g.world,home):null;let screen=null;
      if(p&&g.camera&&g.container){const point=V(p.center.x,(home.baseHeight||0)+(buildingById(home.kind).height+.6),-p.center.y).project(g.camera),w=g.container.clientWidth,h=g.container.clientHeight;screen={x:Math.max(95,Math.min(w-95,(point.x+1)/2*w)),y:Math.max(320,Math.min(h-80,(1-point.y)/2*h))};}
      sleeping={...sleep,...sleepProgress(sleep),homeName:homeName(home),screen,saveError:this.sleepSaveError===sleep.id};
    }
    return {character:id,name:g.ambient?'Your friend':s.characters[id]?.name||'Adam',energy:energyFor(s),max:MAX_ENERGY,hunger:Math.round(hungerFor(s,minutes)),maxHunger:MAX_HUNGER,hungry:isHungry(s,minutes),starving:isStarving(s,minutes),restGain:restGain(s),fishCost:energyCost(s,'fish'),lowEnergy,canSleep:canSleep(s,minutes),sleep:sleeping,homes:homes.map(h=>({id:h.id,name:homeName(h),kind:h.kind})),stateLabel:sleep?'Resting':isStarving(s,minutes)?'Too hungry to work':lowEnergy?'Low energy':'Ready'};
  }
}
