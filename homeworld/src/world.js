import {actionPlaybackRate} from './action-tempo.mjs';
import {CoastalLook} from './coastal-look.js';
import {prepareLivingGardenBase} from './living-garden-rules.mjs';
import {AdaptiveResolution} from './adaptive-resolution.js';
import {moveCharacter,resetAnimatedPose,updateLocomotion,WALK_SPEED} from './character-motion.js';
import {animateGathering,emitChopChips} from './gather-animation.js';
import {createRelaxedIdle} from './character-idle.js';
import {dayPhase,islandLight} from './island-clock.mjs';
import * as THREE from 'three';
import {normalizeCharacterModel} from './character-model.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {scopeKey,migrateLegacyKeys} from './storage-scope.mjs';
/** Build goal, per kid profile (storage-scope.mjs). */
const GOAL_KEY_BASE='gk_island_goal_v1';migrateLegacyKeys([GOAL_KEY_BASE]);const GOAL_KEY=scopeKey(GOAL_KEY_BASE);
import {GameStore,Navigation,SEEDS,activeTrees,plantedTrees,activeStumps,applesReady,APPLES_PER_PICK,gameTime,timeLabel,SAVE_KEY,cellAt,cellFromKey,heightAt,terrainType,growth,canPlow,plotWeedy,dist,label,realDuration} from './core.mjs';
import {communityClaim} from './community.mjs';
import {TREE_MAX_HEALTH,treeRemaining,resourceHealth} from './resource-health.mjs';
import {rockRemaining} from './mining.mjs';
import {Community} from './community-runtime.js';
import {Mining} from './mining.js';
import {toolTier} from './mining.mjs';
import {digPower,digCycleScale,shovelTier} from './digging.mjs';
import {Construction} from './construction.js';
import {activeBuildings,footprint,boundsOverlap,woodTotal,buildingById,buildingProgress} from './building.mjs';
import {ACTIVE_FRACTION} from './project-rules.mjs';
import {Nutrition} from './nutrition.js';
import {energyFor,completedHomes,FOODS,RECIPES,MAX_ENERGY,hungerFor,mealGain,workRate,workRateNote} from './nutrition.mjs';
import {canAffordEnergy} from './nutrition.mjs';
import {MapGesture,cameraOffset,overviewSpan,wrapYaw,PITCH_MIN,PITCH_MAX} from './view-controls.mjs';
import {woodRoom} from './wood-storage.mjs';
import {characterLevels,levelsVisibility,VITALS_PEEK_MS} from './character-vitals.mjs';
import {Residents} from './residents.js';
import {Arrivals} from './arrival-profile.js';
import {AutoWork} from './auto-work.js';
import {Fishing} from './fishing.js';
import {fishingDockDeckHeight} from './fishing-dock.mjs';
import {Animals} from './animals.js';
import {NightSky} from './night-sky.js';
import {planFor} from './island-plan.js';
import {todayBag,withToday,displayGoal,optionsFor,addChoices,dismissOverride,setOverride,assignExtra,clearExtra,displayCoins,journeyMeter,GOALS,defaultGoalId} from './today-goals.mjs';
import {characterKey} from './characters.mjs';
import {registerWellAssets} from './well-model.js';
import {registerOvenAssets} from './oven-model.js';
import {registerDiningHallAssets} from './dining-hall-model.js';
import {Dining} from './dining.js';
import {RecipeKitchen} from './recipe-kitchen.js';
import {Village} from './village.js';
import {GardenKeeper} from './garden-keeper.js';
import {GardenPlan} from './garden-plan.js';
import {BuildAsk} from './build-ask.js';
import {Farmer} from './farmer.js';
import {Stall} from './stall.js';
import {registerFarmBrainAssets} from './farm-model.js';
import {noteEvent,readFeed} from './island-feed.mjs';
import {registerForgeAssets} from './forge-model.js';
import {registerMarketAssets} from './market-model.js';
import {registerDockAssets} from './dock-model.js';
import {StageTracker} from './stage-tracker.js';
import {registerFarmAssets} from './fencing.mjs';
import {IslandMusic} from './island-music.js';
import {LIVING_TEST} from './storage-scope.mjs';
import {LivingIslandTest} from './living-test.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z), Q=()=>new THREE.Quaternion();
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const nativePosition=p=>V(p[0],p[2],-p[1]);
const stageName={seeded:'Seed planted',seedling:'Seedling',growing:'Growing',ready:'Ready'};
/** Cache-busting for map/model files: the service worker is cache-first for .glb, so each build gets its own URL. */
import {BAKE_FRAME,WATER_RIPPLE} from './blender-look.js';
const assetUrl=p=>`${p}?v=${LIVING_TEST?'mobile-1':typeof __HW_BUILD__!=='undefined'?__HW_BUILD__:'dev'}`;

/**
 * Sun shadow box. The sun sits at a fixed offset from the player (placeSun), so the light-space axes
 * never change; only the box extents do. Each frame the box is fitted to the ground the camera can
 * see plus a caster column above it (tall trees, roofs) and a little padding, clamped to the old
 * fixed ±SHADOW_HALF. At the default zoom that is roughly half the old box per side, which is 3-4×
 * the shadow texels per metre — the pixelated walking shadow on iPad came from 1024 texels spread
 * over the whole 46 m box.
 */
const SUN_OFFSET=V(-12,23,12),SHADOW_HALF=23,SHADOW_PAD=2.5,SHADOW_CASTER_HEIGHT=10;
const SUN_Z=SUN_OFFSET.clone().normalize(),SUN_X=V(0,1,0).cross(SUN_Z).normalize(),SUN_Y=SUN_Z.clone().cross(SUN_X);
const SHADOW_CORNERS=[[-1,-1],[1,-1],[1,1],[-1,1]];
const _shadowRay=new THREE.Raycaster(),_shadowNdc=new THREE.Vector2(),_shadowHit=V(),_shadowP=V();

/**
 * iPad-class only: "iPad" in the user agent (Safari, Despia's despia-ipad) or a touch
 * device whose shorter screen side is at least 744 CSS px (iPad mini). Phones are
 * narrower than that, and a desktop has no touch, so both keep the sharper path.
 */
function isIpadClass(){
  if(typeof navigator==='undefined')return false;
  if(/iPad/i.test(navigator.userAgent||''))return true;
  if((navigator.maxTouchPoints||0)<=0)return false;
  const short=Math.min(window.screen?.width||0,window.screen?.height||0);
  return short>=744;
}

export class HomeWorld {
  constructor(container,onUpdate) {
    this.livingTestMode=LIVING_TEST;
    this.container=container;this.onUpdate=onUpdate;this.disposed=false;this.tool='walk';this.seed='carrot_seed';this.path=[];this.order=null;this.action=null;this.status='Loading your island…';this.toasts=[];this.labels=[];this.lastRefresh=0;this.lastSave=0;this.animationRate=1;this.keys=new Set();
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#99b9b0');this.scene.fog=new THREE.Fog('#99b9b0',110,420);
    // Start iPads sharper, then adapt resolution to sustained frame time. MSAA stays on everywhere: on Apple's
    // tile-based GPUs the 4× resolve happens in tile memory and is close to free, and without it the walking
    // character's edges crawl. Phones and desktop stay at min(devicePixelRatio, 1.6).
    this.ipadQuality=isIpadClass();
    this.resolution=this.ipadQuality?new AdaptiveResolution(window.devicePixelRatio||1):null;
    // Shadows follow the sun every frame everywhere, so a walking body never drags a stale shadow. iPad pays for
    // that with the plain PCF filter (hardware 4-tap + 5 rotated samples) on a 1536 map fitted to the view
    // (fitShadow); a slightly wider filter radius hides what staircase is left.
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.resolution?this.resolution.ratio:1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=this.ipadQuality?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.domElement.setAttribute('aria-label','HomeWorld island. Tap the ground to walk; choose a tool to interact.');this.renderer.domElement.tabIndex=0;container.appendChild(this.renderer.domElement);
    this.camera=new THREE.OrthographicCamera(-10,10,10,-10,-80,260);this.zoom=19;this.focus=V(1,1,0);this.overview=false;this.viewYaw=0;this.viewPitch=0;this.mapOnly=false;this.mapSpan=null;
    this.hemi=new THREE.HemisphereLight('#d7e8ef','#6c6f3d',2.4);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight('#fff0cf',3);this.sun.position.copy(SUN_OFFSET);this.sun.castShadow=true;const shadowSize=this.ipadQuality?1536:2048;this.sun.shadow.mapSize.set(shadowSize,shadowSize);this.sun.shadow.camera.left=-SHADOW_HALF;this.sun.shadow.camera.right=SHADOW_HALF;this.sun.shadow.camera.top=SHADOW_HALF;this.sun.shadow.camera.bottom=-SHADOW_HALF;this.sun.shadow.camera.far=70;this.sun.shadow.bias=-.0005;this.sun.shadow.normalBias=.03;if(this.ipadQuality)this.sun.shadow.radius=1.5;this.scene.add(this.sun,this.sun.target);
    this.lantern=new THREE.PointLight('#ffd28b',0,8,1.6);this.scene.add(this.lantern);
    this.dynamic=new THREE.Group();this.scene.add(this.dynamic);this.fields=new THREE.Group();this.scene.add(this.fields);this.seedGroup=new THREE.Group();this.scene.add(this.seedGroup);this.particles=[];this.particleGeometry=new THREE.IcosahedronGeometry(.045,0);this.particleMaterials={wood:new THREE.MeshStandardMaterial({color:'#b17a35',roughness:1}),dirt:new THREE.MeshStandardMaterial({color:'#806139',roughness:1}),seed:new THREE.MeshStandardMaterial({color:'#e1b35a',roughness:.8}),water:new THREE.MeshStandardMaterial({color:'#87e0e7',roughness:.2}),smoke:new THREE.MeshStandardMaterial({color:'#9a9a94',roughness:1,transparent:true,opacity:.55}),ember:new THREE.MeshStandardMaterial({color:'#ffb347',emissive:'#ff7a1a',emissiveIntensity:1.4,roughness:.6})};
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.36,.43,32),new THREE.MeshBasicMaterial({color:'#fff6c3',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;this.scene.add(this.marker);
    this.ray=new THREE.Raycaster();this.mouse=new THREE.Vector2();this.groundPlane=new THREE.Plane(V(0,1,0),-.14);
    this.boundResize=()=>this.resize();this.observer=new ResizeObserver(this.boundResize);this.observer.observe(container);
    this.renderer.domElement.setAttribute('aria-label','HomeWorld island. Drag or swipe sideways to turn the view, and up or down to tilt it. Tap the ground to walk; choose a tool to interact.');
    this.mapGesture=new MapGesture(this.renderer.domElement,{rotate:delta=>this.rotateView(delta),tilt:delta=>this.tiltView(delta),drag:(dx,dy)=>this.panView(dx,dy),tap:e=>this.click(e)});
    this.wheel=e=>{e.preventDefault();if(this.mapOnly&&this.overview)this.setZoomSpan(this.currentMapSpan()+e.deltaY*.06);else this.zoom=THREE.MathUtils.clamp(this.zoom+e.deltaY*.015,8,45);this.resize();};this.renderer.domElement.addEventListener('wheel',this.wheel,{passive:false});
    // Pinch zooms the camera. preventDefault only while two fingers are on the canvas, so the
    // browser does not scale the page. One-finger drags and taps stay on pointer events.
    this.renderer.domElement.style.touchAction='none';
    this.pinching=false;this.pinch=null;
    this.onCanvasTouchStart=e=>{if(e.touches.length<2)return;if(e.cancelable)e.preventDefault();this.armPinch(e);};
    this.onCanvasTouchMove=e=>{if(e.touches.length<2)return;if(e.cancelable)e.preventDefault();if(!this.pinch)this.armPinch(e);this.movePinch(e);};
    this.onCanvasTouchEnd=e=>{if(e.touches.length<2)this.endPinch();};
    this.blockGesture=e=>{e.preventDefault();};
    const canvas=this.renderer.domElement;
    canvas.addEventListener('touchstart',this.onCanvasTouchStart,{passive:false});
    canvas.addEventListener('touchmove',this.onCanvasTouchMove,{passive:false});
    canvas.addEventListener('touchend',this.onCanvasTouchEnd,{passive:true});
    canvas.addEventListener('touchcancel',this.onCanvasTouchEnd,{passive:true});
    canvas.addEventListener('gesturestart',this.blockGesture,{passive:false});
    canvas.addEventListener('gesturechange',this.blockGesture,{passive:false});
    this.onStrokePointer=e=>{if(this.pinching)return;if(this.buildAsk?.takeDrag?.(e))return;if(this.building?.preview?.stroke)this.building.aimFromEvent(e);};
    this.renderer.domElement.addEventListener('pointerdown',this.onStrokePointer);
    this.renderer.domElement.addEventListener('pointermove',this.onStrokePointer);
    this.keyDown=e=>{if(this.livingTest?.arrival?.active)return;if(e.key==='Escape'&&this.interior){e.preventDefault();this.building?.leaveHome();return;}if(this.ambient||this.store?.state.night||this.mapOnly||this.store?.state.characters?.[this.store.state.activeCharacter]?.sleep)return;if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName))return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.lastGroundKey=null;this.keys.add(e.key);}};this.keyUp=e=>this.keys.delete(e.key);window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);
    this.onBlur=()=>{this.mapGesture.cancel();this.endPinch();this.keys.clear();};window.addEventListener('blur',this.onBlur);
    this.markAway=()=>{this.persist();if(this.store&&!this.store.locked)try{this.store.noteAway();}catch(e){this.toast(e.message);}};this.onHide=()=>{if(document.hidden){this.markAway();this.music?.audio?.pause();}else if(this.loaded){this.music?.unlock();this.community?.step({offline:true});this.community?.activity();this.notify();}};this.onUnload=()=>this.markAway();document.addEventListener('visibilitychange',this.onHide);window.addEventListener('pagehide',this.onUnload);this.onStorage=e=>{if(e.key!==SAVE_KEY||!this.store)return;const latest=this.store.readLatest();if(!latest||latest.revision<=this.store.state.revision)return;const moved=dist(latest.player,this.store.state.player)>.6;const changed=JSON.stringify([latest.activeCharacter,latest.removedTrees,latest.removedRocks,latest.rockDamage,latest.treeDamage,latest.woodDrops,latest.inventory,latest.cells,latest.tools,latest.characters?.[latest.activeCharacter],latest.buildings])!==JSON.stringify([this.store.state.activeCharacter,this.store.state.removedTrees,this.store.state.removedRocks,this.store.state.rockDamage,this.store.state.treeDamage,this.store.state.woodDrops,this.store.state.inventory,this.store.state.cells,this.store.state.tools,this.store.state.characters?.[this.store.state.activeCharacter],this.store.state.buildings]);const playing=this.playersOnly&&latest.activeCharacter===this.store.state.activeCharacter&&Date.now()-(this.community?.lastInput||0)<30000;this.store.state=latest;
    // Another HomeWorld window (a second tab with the same save) writes every second while a crew is building. The window
    // being played keeps its walk and position; the idle window follows. Otherwise every tap to walk was undone within a second.
    if(playing){if(changed)this.refreshDynamic();this.notify();return;}
    if((this.action||this.order)&&!changed&&!moved){this.notify();return;}if(this.action?.type==='mine')this.mining.end(this.action);this.nutrition?.clear();this.building?.clearWork();this.building?.cancelPreview();if(this.workTree){this.scene.remove(this.workTree);this.workTree=null;}this.fallingId=null;this.action=null;this.order=null;this.path=[];this.player={...latest.player};Object.values(this.tools||{}).forEach(t=>t.visible=false);this.refreshDynamic();this.notify();};window.addEventListener('storage',this.onStorage);
    this.music=new IslandMusic();this.clock=new THREE.Clock();this.tick=this.tick.bind(this);this.ready=this.load().catch(e=>{console.error(e);this.error=e.message;this.status='The island could not load. Reload to try again.';this.notify();});this.resize();this.raf=requestAnimationFrame(this.tick);
  }
  async load() {
    const loader=new GLTFLoader();
    this.assetAbort=new AbortController();
    this.draco=new DRACOLoader().setDecoderPath('/draco/');loader.setDRACOLoader(this.draco);
    const loadModelUrl=async rawUrl=>{
      const url=new URL(rawUrl,location.href);
      const response=await fetch(url,{signal:AbortSignal.any([this.assetAbort.signal,AbortSignal.timeout(60000)])});
      if(!response.ok)throw Error('The island download needs another try.');
      return loader.parseAsync(await response.arrayBuffer(),url.href.slice(0,url.href.lastIndexOf('/')+1));
    };
    const loadModel=name=>loadModelUrl(assetUrl(`/assets/${this.livingTestMode?'mobile/':''}${name}.glb`));
    const friendModel=new URLSearchParams(location.search).get('friendModel');
    // The first-story reward owns Adam's model. Keep the packaged GLB only as
    // an offline fallback so CMS model updates also appear on the island.
    this.loadFriendModel=()=>friendModel?loadModelUrl(friendModel).catch(()=>loadModel('adam')):loadModel('adam');
    const empty={scene:new THREE.Group(),animations:[]};
    const [world,env,library,adam,construction,houses,woodStores,eve,noah,church]=await Promise.all([
      fetch(assetUrl('/assets/world.json'),{signal:AbortSignal.any([this.assetAbort.signal,AbortSignal.timeout(60000)])}).then(r=>{if(!r.ok)throw Error('Map data is unavailable');return r.json();}),
      ...['environment','library'].map(loadModel),this.livingTestMode?empty:loadModel('adam'),
      ...['construction','house-upgrades','wood-storage'].map(loadModel),
      this.livingTestMode?empty:loadModel('eve'),this.livingTestMode?empty:loadModel('noah'),loadModel('church')
    ]);if(this.disposed)return;
    this.idlePose=this.livingTestMode?{duration:1,apply(){}}:createRelaxedIdle(eve.animations);this.world=world;this.playersOnly=!this.livingTestMode&&new URLSearchParams(location.search).get('players')==='1';this.store=new GameStore(world,localStorage,Date.now(),{playersOnly:this.playersOnly});if(this.livingTestMode&&!this.store.locked)this.store.save(prepareLivingGardenBase(this.store.state,world));if(!this.store.locked)this.store.enableNightCycle();this.player={...this.store.state.player};this.nav=new Navigation(world,this.store.state);this.library={};library.scene.updateMatrixWorld(true);
    for(const root of [library.scene,construction.scene,houses.scene,woodStores.scene,church.scene])root.traverse(o=>{if(o.userData.game_asset_id&&o.userData.prototype)this.library[o.userData.game_asset_id]=o;});registerWellAssets(this.library);registerOvenAssets(this.library);registerDiningHallAssets(this.library);registerForgeAssets(this.library);registerMarketAssets(this.library);registerDockAssets(this.library);registerFarmAssets(this.library,THREE);registerFarmBrainAssets(this.library);
    this.mining=new Mining(this,env.scene);this.addEnvironment(env.scene);
    this.actor=new THREE.Group();this.model=adam.scene;this.actor.add(this.model);if(!this.livingTestMode)normalizeCharacterModel(this.model);this.scene.add(this.actor);this.actor.position.set(this.player.x,this.groundY(this.player.x,this.player.y)+.015,-this.player.y);this.focus.copy(this.actor.position);
    this.restPose=[];this.model.traverse(o=>{if(o.isBone)this.restPose.push({bone:o,position:o.position.clone(),quaternion:o.quaternion.clone()});if(o.isMesh){o.castShadow=true;o.receiveShadow=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.metalness=0;m.metalnessMap=null;m.roughness=.85;m.roughnessMap=null;m.normalScale?.setScalar(.3);if(m.map&&m.map.anisotropy<4)m.map.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());m.needsUpdate=true;}}});
    this.mixer=new THREE.AnimationMixer(this.model);this.clips={};
    for(const original of adam.animations){const clip=original.clone();for(const track of clip.tracks)if(track.name.endsWith('.position')&&/Hips/.test(track.name)){for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}}this.clips[original.name]=this.mixer.clipAction(clip);}
    this.bones={};this.model.traverse(o=>{if(o.isBone)this.bones[o.name.replace(/[^a-zA-Z0-9]/g,'')]=o;});
    this.tools={};for(const id of ['axe','hoe','pickaxe','seed_pouch','watering_can','sickle']){const obj=this.asset(`tool_${id}`);this.tools[id]=obj;obj.visible=false;this.scene.add(obj);}this.mining.prepareTools();
    this.nutrition=new Nutrition(this);this.fishing=new Fishing(this);this.autoWork=new AutoWork(this);this.building=new Construction(this);this.createTreeBatches();this.refreshDynamic();this.drawGardenGrid();this.community=new Community(this,{eve,noah});if(this.livingTestMode)this.community.actors.adam.modelReady=false;this.residents=new Residents(this);this.arrivals=new Arrivals(this);this.dining=new Dining(this);this.kitchen=new RecipeKitchen(this);this.village=new Village(this);this.gardenKeeper=new GardenKeeper(this);this.gardenPlan=new GardenPlan(this);this.buildAsk=new BuildAsk(this);this.stages=new StageTracker(this);this.animals=new Animals(this);this.farmer=new Farmer(this);this.stall=new Stall(this);this.nightSky=new NightSky(this);if(this.playersOnly)this.community.hideBuiltIns();if(this.livingTestMode)this.livingTest=new LivingIslandTest(this);this.loaded=true;this.coastalLook=new CoastalLook(this);if(!this.livingTestMode)this.music?.start();this.status=this.ambient?'Drop off a story friend to start playing.':'Tap land to walk. Open Actions to choose a tool.';if(this.store.error)this.toast(this.store.error);else this.persist();this.notify();
    if(this.livingTestMode)this.friendTimer=setTimeout(()=>this.loadAdamInBackground(),1000);
  }
  async loadAdamInBackground(){
    if(this.disposed||this.friendLoading||this.community.actors.adam.modelReady)return;
    this.friendLoading=true;this.friendError=false;this.notify();
    try{const data=await this.loadFriendModel();if(!this.disposed)this.community.attachAdam(data);}
    catch{if(!this.disposed)this.friendError=true;}
    finally{this.friendLoading=false;this.notify();}
  }
  asset(id) {
    const source=this.library[id];if(!source)throw Error(`Missing asset: ${id}`);
    const clone=source.clone(true);clone.position.set(0,0,0);clone.quaternion.identity();clone.scale.setScalar(id==='tool_hoe'?1.1:1);clone.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return clone;
  }
  /** A fat green clump, clearly taller than bare dirt, so an empty plot reads as weeds. */
  weedClump(){
    if(!this.weedProto){
      const g=new THREE.Group(),mats=['#1f6b2c','#3e9a3a','#7dce4b','#145224'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.78,metalness:0}));
      const blade=new THREE.ConeGeometry(.13,.72,6);
      [[0,0],[.22,.08],[-.2,.12],[.1,-.2],[-.12,-.16],[.24,-.1]].forEach(([x,z],i)=>{
        const m=new THREE.Mesh(blade,mats[i%mats.length]);
        m.position.set(x,.38,z);m.rotation.z=(i-2.5)*.2;m.rotation.x=(i%2?1:-1)*.1;m.castShadow=true;m.receiveShadow=true;g.add(m);
      });
      const flower=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshStandardMaterial({color:'#f2e15a',roughness:.55,metalness:0}));
      flower.position.set(.04,.78,.02);flower.castShadow=true;g.add(flower);
      g.traverse(o=>{o.frustumCulled=false;});this.weedProto=g;
    }
    return this.weedProto.clone(true);
  }
  addEnvironment(root) {
    this.prepareGroundCover(root);
    root.updateMatrixWorld(true);const buckets=new Map();
    const bakedFor=o=>{if(!/^MAT_HW_(Grass|IslandBeach)/.test(o.material?.name||''))return null;for(let n=o;n;n=n.parent){if(/TerrainGrid/.test(n.name))return 'terrain';if(/Sand_Shore/.test(n.name))return 'shore';}return null;};
    this.bakedMaterials={};
    // The scenery's demo plots and crops sit on the 16 garden slots; the game draws real soil and crops there instead.
    const demoGarden=o=>{for(let n=o;n;n=n.parent)if(/^DEMO_HW_(Plot|Crop)/.test(n.name||'')||(this.livingTestMode&&this.store.state.livingGardenLayout==='small'&&/^DEMO_HW_Garden/.test(n.name||'')))return true;return false;};
    root.traverse(o=>{if(!o.isMesh||!o.visible||demoGarden(o))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.length!==1){this.scene.add(o.clone());return;}const baked=bakedFor(o);let mat=mats[0];
      if(baked){mat=this.bakedMaterials[baked]||(this.bakedMaterials[baked]=this.bakedTerrainMaterial(baked,mat));}mat.roughness=Math.max(.65,mat.roughness||0);mat.metalness=0;const geo=o.geometry.clone().toNonIndexed();geo.applyMatrix4(o.matrixWorld);if(o.name==='ENV_HW_Water')geo.scale(6,1,6);for(const key of Object.keys(geo.attributes))if(!['position','normal','color','uv'].includes(key))geo.deleteAttribute(key);if(baked)this.planarUv(geo);if(!geo.attributes.normal)geo.computeVertexNormals();const key=mat.uuid+Object.entries(geo.attributes).map(([k,a])=>`${k}${a.itemSize}`).sort().join(',');if(!buckets.has(key))buckets.set(key,{mat,geos:[],water:/Water|Foam|Shallow/.test(o.name)});buckets.get(key).geos.push(geo);});
    this.staticMeshes=[];
    for(const {mat,geos,water} of buckets.values()){const geo=mergeGeometries(geos,false);if(!geo)throw Error('Could not prepare island geometry');const m=new THREE.Mesh(geo,mat);m.castShadow=!water;m.receiveShadow=!water;this.scene.add(m);this.staticMeshes.push(m);for(const g of geos)g.dispose();}
    this.setupWater();
  }
  /**
   * Grass and beach in the Blender file are procedural shaders (noise clumps, AO, tone ramps) that glTF can't carry,
   * so Blender baked them top-down into terrain-albedo.jpg / shore-albedo.jpg over BAKE_FRAME (world metres).
   * Each terrain mesh gets planar UVs in that frame and one shared textured material.
   */
  bakedTerrainMaterial(kind,src){
    const mat=new THREE.MeshStandardMaterial({name:`HW_Baked_${kind}`,color:0xffffff,roughness:.95,metalness:0});
    new THREE.TextureLoader().load(assetUrl(`/assets/${kind}-albedo.jpg`),tex=>{tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;mat.map=tex;mat.needsUpdate=true;},undefined,()=>{mat.color.copy(src.color);});
    return mat;
  }
  planarUv(geo){
    const [x0,x1,y0,y1]=BAKE_FRAME,pos=geo.attributes.position,uv=new Float32Array(pos.count*2);
    for(let i=0;i<pos.count;i++){uv[i*2]=(pos.getX(i)-x0)/(x1-x0);uv[i*2+1]=(-pos.getZ(i)-y0)/(y1-y0);}
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  /**
   * The Blender file animates the sea in its shader ("water flows in place"), which glTF cannot carry.
   * Recreate it here: planar UVs over the merged ocean plane plus a scrolling tileable normal map, and a
   * slow breathing foam edge. Everything is driven from lighting(dt) each frame.
   */
  setupWater(){
    const ocean=this.staticMeshes.find(m=>/Water/i.test(m.material.name)&&!/Foam|Shallow|Farm|Barrel/i.test(m.material.name));
    this.foam=this.staticMeshes.find(m=>/Foam/i.test(m.material.name))||null;if(this.foam){this.foam.material.transparent=true;this.foamBase=this.foam.material.opacity;}
    if(!ocean)return;
    const pos=ocean.geometry.attributes.position,uv=new Float32Array(pos.count*2);
    const {aspect,flowPerFrame}=WATER_RIPPLE,TILE=6;this.waterUvScale=[aspect[0]/TILE*2,aspect[1]/TILE*2];this.waterFlow=[flowPerFrame[0]*24*this.waterUvScale[0],-flowPerFrame[1]*24*this.waterUvScale[1]];
    for(let i=0;i<pos.count;i++){uv[i*2]=pos.getX(i)*this.waterUvScale[0];uv[i*2+1]=-pos.getZ(i)*this.waterUvScale[1];}
    ocean.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const size=128,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),img=ctx.createImageData(size,size);
    // Tileable 2-octave gradient noise (Blender HW60_Ripples: scale 3, detail 2, roughness .55) → normal map.
    const P=new Uint8Array(512);for(let i=0;i<256;i++)P[i]=i;for(let i=255;i>0;i--){const j=(i*7919+13)%(i+1);[P[i],P[j]]=[P[j],P[i]];}for(let i=0;i<256;i++)P[256+i]=P[i];
    const grad=(h,x,y)=>{const g=h&7;const u=g<4?x:y,v=g<4?y:x;return((g&1)?-u:u)+((g&2)?-2*v:2*v);};const fade=t=>t*t*t*(t*(t*6-15)+10);
    const perlin=(x,y,per)=>{const X=Math.floor(x),Y=Math.floor(y),xf=x-X,yf=y-Y,u=fade(xf),v=fade(yf),w=(a,b)=>P[(P[((a%per)+per)%per]+((b%per)+per)%per)&511];const n00=grad(w(X,Y),xf,yf),n10=grad(w(X+1,Y),xf-1,yf),n01=grad(w(X,Y+1),xf,yf-1),n11=grad(w(X+1,Y+1),xf-1,yf-1);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(n00,n10,u),THREE.MathUtils.lerp(n01,n11,u),v);};
    const cells=6,h=(x,y)=>{const fx=x/size*cells,fy=y/size*cells;return perlin(fx,fy,cells)+.55*perlin(fx*2,fy*2,cells*2);};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=h(x+1,y)-h(x-1,y),dy=h(x,y+1)-h(x,y-1),i=(y*size+x)*4;img.data[i]=128+dx*110;img.data[i+1]=128+dy*110;img.data[i+2]=255;img.data[i+3]=255;}
    ctx.putImageData(img,0,0);
    const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.NoColorSpace;
    const mat=ocean.material;mat.normalMap=tex;mat.normalScale=new THREE.Vector2(WATER_RIPPLE.bumpStrength*1.6,WATER_RIPPLE.bumpStrength*1.6);mat.roughness=Math.min(mat.roughness,.35);mat.needsUpdate=true;
    // Under the orthographic island camera the sea would otherwise run to the top of the screen (parallel rays never
    // reach a horizon). Fade the far water out so the sky dome, with its clouds, shows above it like a real horizon.
    mat.transparent=true;const waterFade={value:new THREE.Vector2(1e6,2e6)};mat.onBeforeCompile=sh=>{sh.uniforms.uWaterFade=waterFade;sh.fragmentShader=sh.fragmentShader.replace('#include <fog_pars_fragment>','#include <fog_pars_fragment>\nuniform vec2 uWaterFade;').replace('#include <fog_fragment>','#include <fog_fragment>\n#ifdef USE_FOG\ngl_FragColor.a*=1.0-smoothstep(uWaterFade.x,uWaterFade.y,vFogDepth);\n#endif');};mat.customProgramCacheKey=()=>'hw-water-fade';
    // Horizon placement: find where the top-of-screen ray meets sea level and cut the water a little before it,
    // so a band of sea always stays between the island and the sky, whatever the tilt.
    const camDir=new THREE.Vector3(),camUp=new THREE.Vector3(),topPoint=new THREE.Vector3(),edge=new THREE.Vector3(),seaY=new THREE.Box3().setFromObject(ocean).max.y;
    const skyHorizon=v=>{const u=this.nightSky?.domeMaterial?.uniforms?.uHorizon;if(u)u.value=v;};
    ocean.onBeforeRender=(renderer,scene,camera)=>{
      if(!camera.isOrthographicCamera||this.overview){waterFade.value.set(1e6,2e6);skyHorizon(1);return;}
      camera.getWorldDirection(camDir);const elev=Math.asin(THREE.MathUtils.clamp(-camDir.y,-1,1));
      // The lower the tilt, the nearer the horizon: at the flattest view the sea ends ~40 units past the focus
      // (a band of open sea beyond the far shore), at the default steep view it runs out of frame.
      const n=THREE.MathUtils.clamp((.62-elev)/(.62-.28),0,1);
      if(n<=0){waterFade.value.set(1e6,2e6);skyHorizon(1);return;}
      // Never closer than a stretch past the far shore; otherwise at ~72% up the screen so a sky band always shows when tilted.
      camUp.set(0,1,0).applyQuaternion(camera.quaternion);topPoint.copy(camera.position).addScaledVector(camUp,camera.top*.6);
      const atScreen=(seaY-topPoint.y)/camDir.y,horizon=Math.max(camera.position.distanceTo(this.focus)+30,atScreen)+150*(1-n);waterFade.value.set(horizon-2.5,horizon+1.5);
      // Tell the sky dome where that sea edge lands on screen, so its pale horizon band starts right there.
      edge.copy(camera.position).addScaledVector(camDir,horizon);if(Math.abs(camUp.y)>1e-4)edge.addScaledVector(camUp,(seaY-edge.y)/camUp.y);
      edge.project(camera);skyHorizon(THREE.MathUtils.clamp(edge.y,-1,1));
    };
    this.water={mesh:ocean,tex,time:0};
  }
  animateWater(dt){
    const w=this.water;if(!w)return;w.time+=dt;
    w.tex.offset.set(w.time*this.waterFlow[0],w.time*this.waterFlow[1]);
    if(this.foam)this.foam.material.opacity=this.foamBase*(.78+.22*Math.sin(w.time*.8));
  }
  prepareGroundCover(root){
    root.updateMatrixWorld(true);this.groundCover=[];this.groundCoverMeshes=[];const managed=[];
    const cosmetic=o=>/^(PRP|RIG)_HW_/.test(o.name)&&/(BerryBush|FernGrass|Dais|Flower|Bloom)/i.test(o.name);
    root.traverse(o=>{if(!cosmetic(o))return;let p=o.parent;while(p&&p!==root){if(cosmetic(p))return;p=p.parent;}managed.push(o);});
    for(const source of managed){
      const box=new THREE.Box3().setFromObject(source),bounds=[box.min.x,-box.max.z,box.max.x,-box.min.z],parts=[];
      source.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.length!==1)return;const geo=o.geometry.clone().toNonIndexed();geo.applyMatrix4(o.matrixWorld);for(const key of Object.keys(geo.attributes))if(!['position','normal','color','uv'].includes(key))geo.deleteAttribute(key);if(!geo.attributes.normal)geo.computeVertexNormals();parts.push({geometry:geo,material:mats[0]});});
      if(parts.length){this.groundCover.push({name:source.name,bounds,parts});source.removeFromParent();}
    }
    this.refreshGroundCover();
  }
  refreshGroundCover(){
    if(!this.groundCover)return;const buildings=activeBuildings(this.store.state),signature=buildings.map(b=>`${b.id}:${b.key}:${b.rotation}`).join('|');if(signature===this.groundCoverSignature)return;this.groundCoverSignature=signature;
    for(const m of this.groundCoverMeshes){this.scene.remove(m);m.geometry.dispose();}this.groundCoverMeshes=[];const occupied=buildings.map(b=>footprint(this.world,b).bounds),buckets=new Map();
    for(const item of this.groundCover){if(occupied.some(b=>boundsOverlap(item.bounds,b)))continue;for(const part of item.parts){const key=part.material.uuid+Object.entries(part.geometry.attributes).map(([k,a])=>`${k}${a.itemSize}`).sort().join(',');if(!buckets.has(key))buckets.set(key,{material:part.material,geometries:[]});buckets.get(key).geometries.push(part.geometry);}}
    for(const b of buckets.values()){const geometry=mergeGeometries(b.geometries,false);if(!geometry)continue;const mesh=new THREE.Mesh(geometry,b.material);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);this.groundCoverMeshes.push(mesh);}
  }
  createTreeBatches() {
    this.treeBatches=[];
    for(const species of Object.keys(this.world.species)){
      const root=this.library[`tree_${species}`];root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();root.traverse(o=>{if(!o.isMesh)return;const m=new THREE.InstancedMesh(o.geometry,o.material,600);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=true;m.receiveShadow=true;m.userData.species=species;m.userData.ids=[];this.scene.add(m);this.treeBatches.push({mesh:m,local:inv.clone().multiply(o.matrixWorld),species});});
    }
  }
  /** Island point the scene is built around: the friend the camera is watching (or a crew focus), else the body you play. Culling and the shadow box follow it, so watching a friend across the island never shows pop-in or cut shadows. */
  viewPoint(){if(this.freeCamera())return {x:this.focus.x,y:-this.focus.z};const a=this.livingTest?.watchActor()||this.residents?.watchActor?.()||this.community?.focusActor?.();return a?.position?{x:a.position.x,y:-a.position.z}:this.player;}
  refreshDynamic() {
    if(!this.store)return;const state=this.store.state,minutes=gameTime(state),view=this.viewPoint();this.trees=activeTrees(this.world,state,minutes);this.allTrees=[...this.world.trees,...plantedTrees(this.world,state,minutes)];
    const nearby=this.trees.filter(t=>dist(view,{x:t.position[0],y:t.position[1]})<(this.overview?200:36)&&t.id!==this.fallingId);const matrix=new THREE.Matrix4(),rot=Q();
    for(const batch of this.treeBatches){const trees=nearby.filter(t=>t.species===batch.species);batch.mesh.count=trees.length;batch.mesh.userData.ids=trees.map(t=>t.id);trees.forEach((t,i)=>{matrix.compose(nativePosition(t.position),rot.setFromAxisAngle(V(0,1,0),t.yaw),V(t.scale[0],t.scale[2],t.scale[1]));batch.mesh.setMatrixAt(i,matrix.clone().multiply(batch.local));});batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingSphere();}
    this.dynamic.clear();
    this.stumpNodes=[];for(const t of activeStumps(this.world,state)){if(dist(view,{x:t.position[0],y:t.position[1]})>30)continue;const stump=this.asset(`stump_${t.species}`);stump.position.copy(nativePosition(t.position));stump.scale.set(t.scale[0],t.scale[2],t.scale[1]);stump.traverse(o=>o.userData.stumpId=t.id);this.dynamic.add(stump);this.stumpNodes.push(stump);}
    this.seedGroup.clear();for(const s of this.world.seeds){if(state.pickedSeeds.includes(s.id)||dist(view,{x:s.position[0],y:s.position[1]})>20)continue;const obj=this.asset(`seed_${s.itemId}`);obj.position.copy(nativePosition(s.position));obj.position.y+=.03;this.seedGroup.add(obj);}
    if(!this.woodDropGroup){this.woodDropGroup=new THREE.Group();this.scene.add(this.woodDropGroup);}this.woodDropGroup.clear();this.woodPickupNodes=[];
    for(const d of state.woodDrops||[]){if(!this.overview&&dist(view,d)>30)continue;const obj=this.asset('wood_pickup');obj.position.set(d.x,heightAt(this.world,d.x,d.y)+.025,-d.y);obj.traverse(o=>o.userData.woodDropId=d.id);this.woodDropGroup.add(obj);this.woodPickupNodes.push(obj);}
    this.fields.clear();this.fieldSignature=[];
    for(const [key,c] of Object.entries(state.cells)){
      const p=cellFromKey(this.world,key),g=growth(c,minutes),soil=this.asset(`tile_${c.seed?'seeded':c.soil==='harvested'?'harvested':'tilled'}${c.soil==='harvested'&&!c.seed?'':g?.hydrated?'_wet':'_dry'}`);soil.position.set(p.x,c.buildingId?(state.buildings.find(b=>b.id===c.buildingId)?.baseHeight??heightAt(this.world,p.x,p.y))+.075:heightAt(this.world,p.x,p.y)+.02,-p.y);this.fields.add(soil);
      if(g){this.fieldSignature.push(`${key}:${g.stage}`);if(g.stage!=='seeded'&&!(g.seed.kind==='tree'&&g.stage==='ready')){const asset=g.seed.kind==='tree'?`treegrowth_${g.seed.plant}_${g.stage==='seedling'?'sapling':'young'}`:`crop_${g.seed.plant}_${g.stage}`;const crop=this.asset(asset);crop.position.copy(soil.position);crop.position.y+=.025;this.fields.add(crop);}}
      if(plotWeedy(c,minutes)){this.fieldSignature.push(`${key}:weeds`);const clump=this.weedClump();let h=0;for(const ch of key)h=(h*33+ch.charCodeAt(0))>>>0;clump.rotation.y=(h%8)*.5;clump.position.copy(soil.position);clump.position.y+=.04;this.fields.add(clump);}
    }
    this.mining?.refresh();this.building?.refresh();this.refreshGroundCover();this.nav=new Navigation(this.world,state,minutes);this.fishing?.makeWalkable(this.nav);
  }
  drawGardenGrid() {
    if(this.livingTestMode&&this.store.state.livingGardenLayout==='small')return;
    const vs=[];for(let i=0;i<=4;i++){vs.push(-4+i,.17,0,-4+i,.17,-4);vs.push(-4,.17,-i,0,.17,-i);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));this.grid=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#e7e2ae',transparent:true,opacity:.35}));this.scene.add(this.grid);
  }
  playClip(name) {
    if(this.currentClip===name||!this.clips[name])return;const prev=this.clips[this.currentClip],next=this.clips[name];next.reset().fadeIn(.18).play();prev?.fadeOut(.18);this.currentClip=name;
  }
  resize() {
    const w=this.container.clientWidth||800,h=this.container.clientHeight||600;this.applyResolution(w,h);this.renderer.setSize(w,h,false);this.updateProjection();
  }
  applyResolution(w=this.container.clientWidth||800,h=this.container.clientHeight||600){
    if(!this.resolution)return;
    const ratio=this.resolution.forSize(w,h);
    if(Math.abs(this.renderer.getPixelRatio()-ratio)>.001)this.renderer.setPixelRatio(ratio);
  }
  currentMapSpan(){const w=this.container.clientWidth||800,h=this.container.clientHeight||600,full=overviewSpan(this.viewYaw||0,w/h);return THREE.MathUtils.clamp(this.mapSpan??full,18,full);}
  updateProjection(){if(this.fishing?.firstPerson)this.fishing.placeCamera();const w=this.container.clientWidth||800,h=this.container.clientHeight||600,wide=this.overview||!!this.siteView,span=this.overview?(this.mapOnly?this.currentMapSpan():overviewSpan(this.viewYaw||0,w/h)):this.zoom;this.scene.fog.near=wide?220:40;this.scene.fog.far=wide?400:120;this.camera.left=-span*w/h/2;this.camera.right=span*w/h/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();}
  rotateView(delta){if(!this.loaded||this.fishing?.active)return;if(this.livingTest?.watching)this.livingTest.stopWatching();if(this.residents?.reel?.active)this.residents.stopReel();if(this.interior&&this.interior.phase!=='exit'){this.interior.lookYaw=THREE.MathUtils.clamp((this.interior.lookYaw||0)+delta,-.8,.8);return;}this.viewYaw=wrapYaw((this.viewYaw||0)+delta);if(this.overview)this.updateProjection();}
  /** Nobody is being played or watched, so a drag should travel the island instead of spinning on one point. */
  freeCamera(){return !!(this.loaded&&this.ambient&&!this.overview&&!this.mapOnly&&!this.interior&&!this.fishing?.firstPerson&&!this.building?.preview&&!this.residents?.watchActor?.()&&!this.community?.focusActor?.());}
  /** Overhead planning view: HUD hides, the camera looks straight down, and a drag or the arrow pad slides anywhere on the island. */
  enterSiteView(){
    if(this.siteView||!this.loaded)return;
    this.residents?.stopReel?.();
    this.siteView={overview:this.overview,zoom:this.zoom,yaw:this.viewYaw||0,pitch:this.viewPitch||0,focus:this.focus.clone()};
    this.overview=false;this.viewYaw=0;this.viewPitch=0;this.zoom=46;this.updateProjection();
    try{window.parent?.postMessage({type:'gk-site-view',on:true},location.origin);}catch{/* The island can run on its own. */}
    this.notify();
  }
  leaveSiteView(){
    const saved=this.siteView;if(!saved)return;
    this.siteView=null;this.overview=saved.overview;this.zoom=saved.zoom;this.viewYaw=saved.yaw;this.viewPitch=saved.pitch;this.focus.copy(saved.focus);
    this.camera.up.set(0,1,0);this.updateProjection();
    try{window.parent?.postMessage({type:'gk-site-view',on:false},location.origin);}catch{/* The island can run on its own. */}
    this.notify();
  }
  /** Metres on the ground. Screen up is north (−Z) while the overhead camera is up. */
  nudgeSite(x,z){
    if(!this.siteView||!this.world)return false;
    const [x0,x1,y0,y1]=BAKE_FRAME;
    this.focus.x=Math.min(x1,Math.max(x0,this.focus.x+x));
    const gy=Math.min(y1,Math.max(y0,-this.focus.z+z));
    this.focus.z=-gy;this.focus.y=0;return true;
  }
  panView(dx,dy){
    if(this.siteView){
      const h=Math.max(1,this.container?.clientHeight||this.renderer?.domElement?.clientHeight||600);
      const metres=(this.zoom||46)/h;
      return this.nudgeSite(-dx*metres,dy*metres);
    }
    if(!this.freeCamera()||!this.world)return false;
    const off=cameraOffset(this.viewYaw||0,false,this.viewPitch||0);
    const fx=-off[0],fz=-off[2],fl=Math.hypot(fx,fz)||1,fwx=fx/fl,fwz=fz/fl,rx=-fwz,rz=fwx;
    const metres=(this.zoom||19)/Math.max(1,this.container?.clientHeight||this.renderer?.domElement?.clientHeight||600);
    const mx=-dx*metres,my=dy*metres;
    this.focus.x+=rx*mx+fwx*my;this.focus.z+=rz*mx+fwz*my;
    const [x0,x1,y0,y1]=BAKE_FRAME;
    this.focus.x=Math.min(x1,Math.max(x0,this.focus.x));
    const gy=Math.min(y1,Math.max(y0,-this.focus.z));
    this.focus.z=-gy;this.focus.y=heightAt(this.world,this.focus.x,gy)+1;
    return true;
  }
  tiltView(delta){if(!this.loaded||this.overview||this.fishing?.active)return;if(this.interior&&this.interior.phase!=='exit'){this.interior.lookPitch=THREE.MathUtils.clamp((this.interior.lookPitch||0)+delta,-.35,.45);return;}this.viewPitch=Math.min(PITCH_MAX,Math.max(PITCH_MIN,(this.viewPitch||0)+delta));}
  /** The last three tools the player reached for, newest first, so they sit one tap away at the bottom of the screen. */
  get recentTools(){if(!this._recentTools){try{const v=JSON.parse(localStorage.getItem('gk_island_recent_tools_v1')||'[]');this._recentTools=Array.isArray(v)?v.filter(id=>typeof id==='string').slice(0,5):[];}catch{this._recentTools=[];}}return this._recentTools;}
  noteTool(id){if(!id||id==='walk')return;const next=[id,...this.recentTools.filter(t=>t!==id)].slice(0,5);if(next.join()===this.recentTools.join())return;this._recentTools=next;try{localStorage.setItem('gk_island_recent_tools_v1',JSON.stringify(next));}catch{/* remembered for this visit only */}this.notify();}
  setTool(tool){if(tool!=='walk'&&this.ambientNudge())return;if(this.building?.clearPlan)this.building.clearPlan=null;if(this.building?.preview)this.building.cancelPreview();this.tool=tool;this.noteTool(tool);this.status={walk:'Tap land to walk. Open Actions to choose a tool.',axe:'Axe ready! Tap land to walk or a tree to chop.',mine:'Pickaxe ready! Tap land to walk or a rock to smash.',hoe:'Dig ready! Tap clear grass to dig, or weeds to clear a garden spot.',plant:'Seeds ready! Tap land to walk or an empty garden spot to plant.',water:'Watering can ready! Tap land to walk or a growing plant to water.',fish:'Rod ready! Tap land to walk or water to fish.'}[tool];this.notify();}
  /** Drop a leftover IK pose (apple reach, prayer) so the next walk or chop starts clean. */
  releasePose(){
    this.livingTest?.actions.clear();
    resetAnimatedPose(this);
    const home=this.actor?.userData;
    if(home){home.idling=false;home.flourish=null;}
  }
  unequipTool(){
    const cancellable=['chop','mine','plow','clear_weeds','dig_stump','dig_mud','pick_apples','plant','water','harvest','fish'];
    if(this.building)this.building.clearPlan=null;
    if(cancellable.includes(this.action?.type)){
      const a=this.action;
      if(a.type==='chop'||a.type==='mine'){
        if(!this.stopGathering())this.finishAction();
      }else{
        if(a.type==='fish'){if(this.fishing?.active){this.fishing.quit();return;}this.nutrition?.clear();}
        this.action=null;
      }
      this.path=[];this.order=null;this.marker.visible=false;this.persist();
    }else if(cancellable.includes(this.order?.type)){
      this.path=[];this.order=null;this.marker.visible=false;this.persist();
    }
    if(this.pinJob==='pick_apples')this.pinJob=null;
    this.resourceTarget=null;Object.values(this.tools||{}).forEach(t=>t.visible=false);
    this.releasePose();
    this.setTool('walk');
  }
  setSeed(seed){this.seed=seed;this.setTool('plant');}
  selectCharacter(id){
    if(this.livingTestMode)return false;
    if(!this.loaded||this.store.state.night||!this.community?.actors[id])return false;if(id===this.store.state.activeCharacter){this.revealCharacterVitals();return true;}
    if(this.action||this.nutrition.sleep){this.toast('Finish this action or wake up before switching characters.');return false;}
    try{
      this.store.persistPlayer(this.player);this.store.communityStep({active:true});const previousId=this.store.state.activeCharacter;
      this.store.commit({type:'select_character',id,previousId,position:{...this.player},actionId:crypto.randomUUID()});if(this.store.state.activeCharacter!==id){this.toast('This character is sleeping. Try again when they wake up.');return false;}
      this.keys.clear();this.path=[];this.order=null;this.manualMoving=false;this.lastGroundKey=null;this.marker.visible=false;this.building.cancelPreview();this.nutrition.clear();Object.values(this.tools).forEach(t=>t.visible=false);
      this.community.bindActive(id);this.player={...this.store.state.player};this.actor.position.set(this.player.x,this.groundY(this.player.x,this.player.y)+.015,-this.player.y);this.community.activity();this.overview=false;this.resize();this.refreshDynamic();this.revealCharacterVitals();this.status=`Playing as ${this.store.state.characters[id].name}. Tap land to walk.`;this.notify();return true;
    }catch(e){this.toast(e.message);return false;}
  }
  revealCharacterVitals(wall=Date.now(),id=this.store?.state.activeCharacter){
    const actor=id===this.store?.state.activeCharacter?this.actor:this.community?.actors[id]?.actor;
    if(!this.loaded||this.store?.state.night||this.mapOnly||this.overview||!actor?.visible||this.store.state.characters[id]?.sleep)return false;
    if(id===this.store.state.activeCharacter)this.vitalsShownUntil=wall+VITALS_PEEK_MS;else{this.memberVitalsUntil??={};this.memberVitalsUntil[id]=wall+VITALS_PEEK_MS;}return true;
  }
  characterVitalsSnapshot(wall=Date.now(),id=this.store?.state.activeCharacter){
    const actor=id===this.store?.state.activeCharacter?this.actor:this.community?.actors[id]?.actor;
    if(!this.loaded||this.store?.state.night||this.mapOnly||this.overview||!actor?.visible||this.store.state.characters[id]?.sleep)return null;
    const rect=this.renderer.domElement.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return null;
    this.camera.updateMatrixWorld(true);actor.updateWorldMatrix(true,false);const base=actor.getWorldPosition(V());
    const project=height=>{const p=base.clone().add(V(0,height,0)).project(this.camera);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2,z:p.z};};
    const feet=project(.1),head=project(2),anchor=project(2.55),width=Math.max(48,.85*h/(this.camera.top-this.camera.bottom)),height=Math.max(56,Math.abs(feet.y-head.y)+10);
    if(head.z< -1||head.z>1||head.x< -width||head.x>w+width||Math.max(feet.y,head.y)<0||Math.min(feet.y,head.y)>h)return null;
    const levels=characterLevels(this.store.state,gameTime(this.store.state,wall),id),visibility=levelsVisibility(levels,(id===this.store.state.activeCharacter?this.vitalsShownUntil:this.memberVitalsUntil?.[id])||0,wall);
    return {...levels,...visibility,selected:id===this.store.state.activeCharacter,hit:{x:head.x-width/2,y:Math.min(head.y,feet.y)-5,width,height},screen:{x:Math.max(88,Math.min(w-88,anchor.x)),y:Math.max(112,Math.min(h-16,anchor.y-8))}};
  }
  allCharacterVitalsSnapshots(wall=Date.now()){return Object.keys(this.store?.state.characters||{}).map(id=>this.characterVitalsSnapshot(wall,id)).filter(Boolean);}
  click(e) {
    if(!this.loaded||this.mapOnly||this.fishing?.active)return;const r=this.renderer.domElement.getBoundingClientRect();this.mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);if(this.buildAsk?.picking){this.buildAsk.takeTap(e);return;}if(this.residents?.consumeTap(e))return;
    if(this.store?.state.night||this.action?.type==='sleep'||this.store.state.characters?.[this.store.state.activeCharacter]?.sleep){if(!this.interior)this.animals?.roundUp(this.animals.pick(this.ray));return;}
    if(this.interior){if(this.interior.phase!=='exit') this.lookInside(e,r);return;}
    if(this.building?.preview?.stroke){this.building.aimFromEvent(e);this.building.stamp();return;}
    if(this.building?.wellId){this.building.wellId=null;this.notify();}
    if(this.ambient){this.prompt=null;if(this.building?.offerHome(this.ray)) return;this.ambientNudge();return;}
    if((this.playersOnly||this.livingTestMode)&&!this.building?.preview&&this.fishing?.pickPole(this.ray)&&!this.action){this.residents?.closeMenu();this.nutrition.goFish();return;}
    const dockTarget=!this.building?.preview?this.fishing?.walkTarget(this.ray):null;
    if(dockTarget){this.tool='walk';this.walk(dockTarget);return;}
    if(this.playersOnly){const friend=this.residents?.pick(this.ray)||(this.residents?.bodyHit(e.clientX,e.clientY)?this.actor:null);if(friend){if(friend!==this.actor){this.residents.watch(friend);return;}this.residents.greet(this.actor);this.status=this.autoWork?.active?`${this.actor.userData.name} is ${this.autoWork.paused?'paused':'working'}. Pause, keep going, or stop.`:`${this.actor.userData.name} says hello.`;this.notify();return;}this.residents?.closeMenu();if(this.autoWork?.active&&!this.autoWork.paused)this.autoWork.pause();}
    if(this.livingTest&&!this.building?.preview&&this.livingTest.click(this.ray,{walk:false}))return;
    const x=e.clientX-r.left,y=e.clientY-r.top,levels=this.allCharacterVitalsSnapshots().find(l=>x>=l.hit.x&&x<=l.hit.x+l.hit.width&&y>=l.hit.y&&y<=l.hit.y+l.hit.height);if(!this.livingTestMode&&!this.building?.preview&&levels){if(levels.id===this.store.state.activeCharacter)this.revealCharacterVitals(Date.now(),levels.id);else this.selectCharacter(levels.id);return;}
    this.prompt=null;
    if(this.building?.preview){const p=V();if(this.ray.ray.intersectPlane(this.groundPlane,p))this.building.moveTo({x:p.x,y:-p.z});return;}
    if(this.animals?.placing){const p=V();if(this.ray.ray.intersectPlane(this.groundPlane,p)){this.animals.placeAt({x:p.x,y:-p.z});}return;}if(this.animals?.tap(this.animals.pick(this.ray)))return;
    if(this.building?.inspectRay(this.ray))return;
    if(this.woodPickupNodes?.length){const hit=this.ray.intersectObjects(this.woodPickupNodes,true)[0],drop=this.store.state.woodDrops?.find(d=>d.id===hit?.object.userData.woodDropId);if(drop){if(!woodRoom(this.store.state))this.toast('Wood space is full. Open My bag to build a store.');else this.walk(drop);return;}}
    if(this.tool==='mine'){const meshes=[...this.mining.nodes.values()].filter(n=>n.group.visible&&!this.store.state.removedRocks.includes(n.id)).map(n=>n.mesh);const hit=this.ray.intersectObjects(meshes,true)[0];if(hit){let node=hit.object;while(node&&!node.userData.rockId)node=node.parent;if(node?.userData.rockId)this.mining.mine(node.userData.rockId);return;}}
    const hits=this.ray.intersectObjects(this.treeBatches.map(b=>b.mesh),false);if(hits.length){const hit=hits[0],id=hit.object.userData.ids[hit.instanceId];if(id){if(this.tool==='axe'){this.chop(id);return;}if(this.offerTree(id))return;}}
    if(this.tool!=='mine'){const meshes=[...this.mining.nodes.values()].filter(n=>n.group.visible&&!this.store.state.removedRocks.includes(n.id)).map(n=>n.mesh);const hit=this.ray.intersectObjects(meshes,true)[0];if(hit){let node=hit.object;while(node&&!node.userData.rockId)node=node.parent;if(node?.userData.rockId){const rock=this.world.boulders.find(r=>r.id===node.userData.rockId);this.showPrompt('rock',rock.id,{x:rock.position[0],y:rock.position[1]},(rock.radius||.5)+.9,[{id:'mine',label:'Smash',icon:'mine'}]);return;}}}
    if(this.stumpNodes?.length){const hit=this.ray.intersectObjects(this.stumpNodes,true)[0],stumpId=hit?.object.userData.stumpId;if(stumpId&&this.offerStump(this.world.trees.find(t=>t.id===stumpId)))return;}
    const p=V();if(!this.ray.ray.intersectPlane(this.groundPlane,p))return;const target={x:p.x,y:-p.z},cell=cellAt(this.world,target.x,target.y);
    if(this.offerStump(target))return;
    if(this.tool==='fish'&&terrainType(this.world,target.x,target.y)===0){this.nutrition.goFish();return;}
    if(this.tool==='hoe'){if(!this.action&&['plow','dig_stump','clear_weeds'].includes(this.order?.type)){this.path=[];this.order=null;this.marker.visible=false;}if(terrainType(this.world,target.x,target.y)===1){this.digMud(cell.key);return;}if(this.gardenPlot(cell.key))this.peekPlant(cell.key);if(plotWeedy(this.store.state.cells[cell.key],gameTime(this.store.state))){const queued=this.gardenAction('clear_weeds',cell.key);if(queued===false&&!canAffordEnergy(this.store.state,'clear_weeds'))this.walk(target);return;}const queued=this.gardenAction('plow',cell.key);if(queued===false&&!canAffordEnergy(this.store.state,'plow'))this.walk(target);return;}
    const plot=this.store.state.cells[cell.key],planted=growth(plot,gameTime(this.store.state));
    if(this.tool!=='plant'&&plot?.soil&&!plot.seed&&!plotWeedy(plot,gameTime(this.store.state))){this.peekPlant(cell.key);return;}
    if(this.gardenPlot(cell.key)){
      // Walk tool: tapping the garden opens the card (fenced %, Abel's next request, the plan).
      if(this.tool==='walk'&&this.playersOnly&&this.gardenKeeper){this.plantPeek=null;this.openGarden();return;}
      this.peekPlant(cell.key);
    }
    if(planted?.stage==='ready'&&planted.seed.kind==='crop'){this.gardenAction('harvest',cell.key);return;}
    if(this.tool==='plant'&&plot?.soil&&!plot.seed){if(plotWeedy(plot,gameTime(this.store.state))){this.toast('Clear the weeds first.',1600);return;}this.gardenAction('plant',cell.key);return;}
    if(this.tool==='water'&&planted?.thirsty){this.gardenAction('water',cell.key);return;}
    if(planted&&this.tool==='walk')return; // a tap on a plant just peeks at its progress
    this.walk(target);
  }
  /** While inside a home, a tap swings the view a little. The character stays outside the walls. */
  lookInside(e,r){
    const rect=r||this.renderer.domElement.getBoundingClientRect();if(!rect.width) return;
    const nx=(e.clientX-rect.left)/rect.width*2-1,ny=(e.clientY-rect.top)/rect.height*2-1,inn=this.interior;
    inn.lookYaw=THREE.MathUtils.clamp((inn.lookYaw||0)-nx*.45,-.8,.8);
    inn.lookPitch=THREE.MathUtils.clamp((inn.lookPitch||0)+ny*.25,-.35,.45);
  }
  /** Screen anchor for the small well card. Falls back to the lower middle when the well is off screen. */
  wellPopup(){
    const id=this.building?.wellId;if(!id||!this.loaded||this.interior) return null;
    const card=this.nutrition?.wellCard(id);if(!card){this.building.wellId=null;return null;}
    const b=this.store.state.buildings.find(x=>x.id===card.id),fp=b&&footprint(this.world,b);
    const rect=this.renderer.domElement.getBoundingClientRect(),w=rect.width,h=rect.height;
    let x=w/2,y=h*.72;
    if(w&&h&&fp){
      this.camera.updateMatrixWorld(true);
      const pr=V(fp.center.x,(b.baseHeight||0)+1.7,-fp.center.y).project(this.camera);
      if(pr.z>-1&&pr.z<1&&Math.abs(pr.x)<1.15&&Math.abs(pr.y)<1.15){x=(pr.x+1)*w/2;y=(1-pr.y)*h/2;}
    }
    const full=card.water>=card.max,far=card.away>2.6;
    return {...card,x:Math.max(150,Math.min(w-150,x)),y:Math.max(130,Math.min(h-70,y)),canFetch:!full&&!far&&!card.busy,reason:full?'Bag is full':far?'Walk closer':card.busy?'Busy just now':''};
  }
  /** Ground, or the top of the harbour planks when the point is on a finished dock. */
  groundY(x,y){const ground=heightAt(this.world,x,y),fishing=fishingDockDeckHeight(this.world,(sx,sy)=>heightAt(this.world,sx,sy),x,y),coop=this.livingTest?.farm?.surfaceHeight(x,y),coopY=coop==null?-Infinity:heightAt(this.world,this.livingTest.farm.position.x,this.livingTest.farm.position.y)+coop,deck=Math.max(fishing??-Infinity,coopY);return Number.isFinite(deck)?Math.max(ground,deck):ground;}
  walk(target) {
    if(this.livingTest){this.livingTest.activity();this.livingTest.garden.cancel();}
    if(this.interior) return;
    if(this.ambientNudge())return;
    this.residents?.cancelWave();
    this.pinJob=null;
    if(this.action){this.toast('Your character is finishing this action.');return;}const path=this.nav.path(this.player,target);if(!path){this.toast('There is no clear path there. Try a closer patch of land.');return;}this.lastGroundKey=cellAt(this.world,target.x,target.y).key;this.path=path;this.order=null;this.marker.position.set(target.x,this.groundY(target.x,target.y)+.035,-target.y);this.marker.visible=true;this.status='Walking…';this.notify();
  }
  walkSurfaceHeight(x,y){return this.groundY(x,y);}
  collectNearbyWood(){
    if(this.action||this.order||!woodRoom(this.store.state))return false;let changed=false;for(const drop of this.store.state.woodDrops||[]){if(dist(this.player,drop)>.9||!woodRoom(this.store.state))continue;try{this.store.persistPlayer(this.player);const before=woodTotal(this.store.state);this.store.commit({type:'pickup_wood',id:drop.id});const gained=woodTotal(this.store.state)-before;if(gained){this.toast(`+${gained} wood put away`);this.burst(drop,'wood',.2);changed=true;}}catch(e){this.toast(e.message);break;}}
    return changed;
  }
  request(action,target,reach) {
    if(this.ambientNudge())return false;
    this.residents?.cancelWave();
    if(this.store.state.characters[this.store.state.activeCharacter]?.sleep){this.toast('Wake up before starting more work.');return false;}
    if(this.action){this.toast('Your character is finishing this action.');return false;}
    this.livingTest?.garden.cancel();
    if(this.nutrition&&!this.nutrition.check(action.type==='chop'?'chop_hit':action))return false;
    const path=this.nav.approach(this.player,target,reach,action.type==='mine'?{x:.52,y:-.85}:null);if(!path){this.toast('Your character cannot reach that spot. Try another side or a closer tile.');return false;}
    if(action.type==='chop'||action.type==='mine')this.touchResourceHealth(action.type==='chop'?'tree':'rock',action.id);
    if(action.type==='pick_apples'&&this.autoWork?.active)this.autoWork.stop(true);
    this.pinJob=action.type==='pick_apples'?'pick_apples':null;
    this.lastGroundKey=null;this.path=path;this.order={...action,target};this.status='Walking to '+(action.type==='chop'?'the tree…':action.type==='mine'?'the rock…':'the tile…');this.marker.visible=true;this.marker.position.set(target.x,heightAt(this.world,target.x,target.y)+.04,-target.y);this.notify();return true;
  }
  chop(id) {
    const tree=this.trees.find(t=>t.id===id);if(!tree)return;if(!woodRoom(this.store.state)){this.toast('Wood space is full. Open My bag to build a store.');return false;}this.tool='axe';return this.request({type:'chop',id,tree},{x:tree.position[0],y:tree.position[1]},1.18+tree.radius*.2);
  }
  /** Tapping a tree without the axe: offer what can be done with it (chop, and pick apples when they are ripe). */
  offerTree(id){
    const tree=[...this.world.trees,...plantedTrees(this.world,this.store.state,gameTime(this.store.state))].find(t=>t.id===id);if(!tree)return false;
    const actions=[];if(tree.species==='apple'&&!String(id).startsWith('planted:')&&applesReady(this.store.state,id,gameTime(this.store.state)))actions.push({id:'pick',label:'Pick apples',icon:'apple_seed'});
    actions.push({id:'chop',label:'Chop',icon:'axe'});
    this.showPrompt('tree',id,{x:tree.position[0],y:tree.position[1]},(tree.radius||.4)+2.2,actions);return true;
  }
  /** A tap on the stump, or on the grass it sits in, offers a shovel instead of walking past it. */
  offerStump(point){
    if(!point)return false;
    const here=cellAt(this.world,point.x??point.position?.[0],point.y??point.position?.[1]);
    let best=null,bestD=Infinity;
    for(const t of activeStumps(this.world,this.store.state)){
      const spot={x:t.position[0],y:t.position[1]},d=dist(here,spot);
      if(cellAt(this.world,spot.x,spot.y).key!==here.key&&d>1.15)continue;
      if(d<bestD){best=t;bestD=d;}
    }
    if(!best)return false;
    this.showPrompt('stump',best.id,{x:best.position[0],y:best.position[1]},1.2,[{id:'dig',label:'Dig out the stump',icon:'shovel'}]);
    return true;
  }
  /** A little floating menu over a tapped object. It fades when you walk off, start something else, or after a few seconds. */
  showPrompt(kind,id,position,height,actions){this.prompt={kind,id,position,height,actions,until:Date.now()+8000};this.notify();}
  prayerSnapshot(){
    const p=this.prayer;if(!p)return null;if(performance.now()>p.until||(this.action&&this.action.type!=='pray'&&performance.now()>p.until-6000)){this.prayer=null;return null;}
    const rect=this.renderer.domElement.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return null;
    const who=p.actor&&p.actor.parent?p.actor:this.actor;this.camera.updateMatrixWorld(true);who.updateWorldMatrix(true,false);const pr=who.getWorldPosition(V()).add(V(0,1.75,0)).project(this.camera);if(pr.z<-1||pr.z>1)return null;
    return {text:p.text,verse:p.verse,name:p.name,praying:this.action?.type==='pray',x:Math.max(150,Math.min(w-150,(pr.x+1)*w/2)),y:Math.max(60,Math.min(h-40,(1-pr.y)*h/2))};
  }
  promptSnapshot(){
    const p=this.prompt;if(!p||!this.loaded||this.overview||this.mapOnly||this.action||this.order||Date.now()>p.until){if(p&&(this.action||this.order||Date.now()>p.until))this.prompt=null;return null;}
    const rect=this.renderer.domElement.getBoundingClientRect();if(!rect.width)return null;this.camera.updateMatrixWorld(true);
    const pr=V(p.position.x,heightAt(this.world,p.position.x,p.position.y)+p.height,-p.position.y).project(this.camera);if(pr.z<-1||pr.z>1||Math.abs(pr.x)>1.1||Math.abs(pr.y)>1.1)return null;
    return {kind:p.kind,id:p.id,actions:p.actions,x:Math.max(60,Math.min(rect.width-60,(pr.x+1)*rect.width/2)),y:Math.max(70,(1-pr.y)*rect.height/2)};
  }
  runPrompt(actionId){
    const p=this.prompt;if(!p)return;this.prompt=null;
    if(actionId==='coop-enter')this.livingTest?.farm.openCoop();else if(actionId==='coop-move')this.livingTest?.farm.startMove();else if(actionId==='building-open')this.building.openBuilding(p.id);else if(actionId==='chop')this.chop(p.id);else if(actionId==='pick')this.pickApples(p.id);else if(actionId==='mine')this.mining.mine(p.id);else if(actionId==='dig')this.digStump(p.id);else if(actionId==='enter')this.building.enterHome(p.id);else if(actionId==='move')this.building.moveExisting(p.id);else if(actionId==='remove')this.building.askRemove(p.id);
    this.notify();
  }
  /** Walk to an apple tree and gather its fruit. No tool or energy needed; the tree fruits again later. */
  pickApples(id){
    const tree=this.world.trees.find(t=>t.id===id);if(!tree||tree.species!=='apple'||this.store.state.removedTrees.includes(id))return false;
    if(!applesReady(this.store.state,id,gameTime(this.store.state))){this.toast('These apples were just picked. They grow back in about half a day.');return false;}
    this.tool='walk';return this.request({type:'pick_apples',id,tree},{x:tree.position[0],y:tree.position[1]},(tree.radius||.4)+.9);
  }
  /** Dig tool on the beach: scoop up a lump of mud (two mud + water dries into a clay brick). */
  digMud(key){
    const p=cellFromKey(this.world,key);if(terrainType(this.world,p.x,p.y)!==1)return false;this.tool='hoe';return this.request({type:'dig_mud',key},p,.95);
  }
  /** Dig tool on a stump: walk over and dig it out so the ground is clear for building. */
  digStump(id){
    const tree=this.world.trees.find(t=>t.id===id);if(!tree||!activeStumps(this.world,this.store.state).some(t=>t.id===id))return false;this.tool='hoe';return this.request({type:'dig_stump',id,tree},{x:tree.position[0],y:tree.position[1]},.95);
  }
  nearestTree(){const trees=[...this.trees].sort((a,b)=>dist(this.player,{x:a.position[0],y:a.position[1]})-dist(this.player,{x:b.position[0],y:b.position[1]}));for(const t of trees.slice(0,12))if(this.nav.approach(this.player,{x:t.position[0],y:t.position[1]},1.22))return this.chop(t.id);this.toast('Walk closer to a reachable tree.');}
  digHere(){const key=this.lastGroundKey||cellAt(this.world,this.player.x,this.player.y).key;if(plotWeedy(this.store.state.cells[key],gameTime(this.store.state)))return this.gardenAction('clear_weeds',key);return this.gardenAction('plow',key);}
  gardenAction(type,key) {
    if(this.ambientNudge())return false;
    const minutes=gameTime(this.store.state);
    if(!key){const keys=[...new Set([...this.world.gardenSlots.map(s=>s.key),...activeBuildings(this.store.state).filter(b=>b.kind==='garden'&&b.status==='complete').flatMap(b=>footprint(this.world,b).keys)])];const slots=keys.map(key=>cellFromKey(this.world,key));const candidates=slots.filter(p=>{const c=this.store.state.cells[p.key],g=growth(c,minutes);return type==='plow'?canPlow(this.world,this.store.state,p.key)&&!c?.soil:type==='clear_weeds'?plotWeedy(c,minutes):type==='plant'?c?.soil&&!c.seed&&!plotWeedy(c,minutes):type==='water'?!!g?.thirsty:g?.stage==='ready'&&g.seed.kind==='crop';});candidates.sort((a,b)=>dist(a,this.player)-dist(b,this.player));if(!candidates.length){if(type==='clear_weeds')return;const weedy=type==='plant'&&slots.some(p=>plotWeedy(this.store.state.cells[p.key],minutes));this.toast(type==='plow'?'Your garden is dug! Tap empty grass to make another spot.':type==='plant'?(weedy?'Clear the weeds first.':'Choose Dig to make a garden spot first.'):type==='water'?'Plant a seed first, or choose a tile that has not been watered.':'No garden crops are ready yet.',weedy?1600:undefined);return;}key=candidates[0].key;}
    if(communityClaim(this.store.state,key)){this.toast('Eve is caring for that plant. Try another spot.');return;}
    const c=this.store.state.cells[key],g=growth(c,minutes);
    if(type==='plow'&&(!canPlow(this.world,this.store.state,key)||c?.soil)){this.toast('Choose clear grass without a tree, rock, path or existing plot.');return;}
    if(type==='clear_weeds'&&!plotWeedy(c,minutes)){this.toast('No weeds on this spot.');return;}
    if(type==='plant'&&plotWeedy(c,minutes)){this.toast('Clear the weeds first.',1600);return;}
    if(type==='plant'&&(!c?.soil||c.seed)){this.toast('Choose a prepared, empty tile.');return;}
    if(type==='plant'&&!(this.store.state.inventory[this.seed]>0)){this.toast('You need more of that seed. Collect seeds around the island.');return;}
    if(type==='water'&&!g?.thirsty){this.toast(g?(g.stage==='ready'?'This crop is ready to pick.':'This plant is still wet. It will ask for water when it needs it.'):'Plant a seed in this tile first.');return;}
    if(type==='harvest'&&(!g||g.stage!=='ready'||g.seed.kind!=='crop')){this.toast('This crop is still growing.');return;}
    const p=cellFromKey(this.world,key),digging=type==='plow'||type==='clear_weeds';if(type!=='harvest')this.tool=digging?'hoe':type;return this.request({type,key,seed:this.seed},p,digging?0.95:1);
  }
  /** Screen anchors for crops that are ready: one tap on the icon walks over and picks them, no tool needed. */
  harvestPrompts(){
    if(!this.loaded||this.overview||this.mapOnly||this.action)return [];
    const s=this.store.state,min=gameTime(s),rect=this.renderer.domElement.getBoundingClientRect();if(!rect.width)return [];
    this.camera.updateMatrixWorld(true);const out=[];
    for(const [key,c] of Object.entries(s.cells)){if(!c.seed)continue;const g=growth(c,min);if(!g||communityClaim(s,key))continue;const ready=g.stage==='ready'&&g.seed.kind==='crop';if(!ready&&!g.thirsty)continue;const p=cellFromKey(this.world,key),pr=V(p.x,heightAt(this.world,p.x,p.y)+.95,-p.y).project(this.camera);if(Math.abs(pr.x)>.95||Math.abs(pr.y)>.9)continue;out.push({key,kind:ready?'harvest':'water',plant:g.seed.plant,name:g.seed.name,x:(pr.x+1)*rect.width/2,y:(1-pr.y)*rect.height/2,d:dist(this.player,p)});}
    return out.sort((a,b)=>(a.kind==='harvest'?0:1)-(b.kind==='harvest'?0:1)||a.d-b.d).slice(0,10);
  }
  snakePrompts(){
    if(!this.loaded||this.overview||this.mapOnly||this.action)return [];
    const snakes=(this.store.state.animals||[]).filter(a=>a.kind==='snake'&&a.wild!==false);
    if(!snakes.length)return [];
    const rect=this.renderer.domElement.getBoundingClientRect();if(!rect.width)return [];
    this.camera.updateMatrixWorld(true);const out=[];
    for(const snake of snakes){const pr=V(snake.x,heightAt(this.world,snake.x,snake.y)+.7,-snake.y).project(this.camera);if(Math.abs(pr.x)>1.05||Math.abs(pr.y)>1.05)continue;out.push({id:snake.id,x:(pr.x+1)*rect.width/2,y:(1-pr.y)*rect.height/2});}
    return out.slice(0,3);
  }
  startAction(order) {
    this.livingTest?.garden.cancel();
    if(this.ambientNudge()){this.order=null;this.path=[];if(this.marker)this.marker.visible=false;return;}
    if(order.type==='stoke'){this.order=null;this.path=[];this.marker.visible=false;this.nutrition.commitStoke(order.fireId);return;}
    if(order.type==='fetch_water'){this.order=null;this.path=[];this.marker.visible=false;this.nutrition.commitFetchWater(order.wellId);return;}
    if(order.type==='craft_brick'){this.order=null;this.path=[];this.marker.visible=false;this.nutrition.commitCook(order.recipe,order.wellId);return;}
    if(order.type==='chop'&&!woodRoom(this.store.state)){this.order=null;this.path=[];this.marker.visible=false;this.toast('Wood space is full. Open My bag to build a store.');return;}
    if(this.nutrition&&!this.nutrition.check(order.type==='chop'?'chop_hit':order)){this.order=null;this.path=[];this.marker.visible=false;return;}
    // A new action replaces whatever was in progress. Drop the old one first so a held snack, tool, or IK pose cannot stay behind.
    if(this.action&&this.action.type!=='sleep'){const prev=this.action;if(prev.type==='mine')this.mining.end(prev);if(prev.type==='pray'){this.prayer=null;this.nutrition?.hushPrayer();}this.nutrition?.clear();this.building?.clearWork?.();if(this.workTree){this.scene.remove(this.workTree);this.workTree=null;}this.fallingId=null;Object.values(this.tools||{}).forEach(t=>t.visible=false);this.action=null;}
    this.releasePose();
    this.persist();const digging=['plow','clear_weeds','dig_stump','dig_mud'].includes(order.type),power=digging?digPower(this.store.state):toolTier(this.store.state).power,shovel=digging?shovelTier(this.store.state):null;this.action={...order,t:0,hits:0,committed:false,gatherId:crypto.randomUUID(),workHits:order.type==='plow'?1:Math.ceil((order.type==='chop'?treeRemaining(order.tree,this.store.state):2)/power),...(digging?{digScale:digCycleScale(this.store.state),...(shovel?.tier>=2?{shovelName:shovel.short}:{})}:{})};this.order=null;this.path=[];this.marker.visible=false;if(dist(order.target,this.player)>.05)this.actor.rotation.y=Math.atan2(order.target.x-this.player.x,-(order.target.y-this.player.y));this.playClip('Idle_03');
    this.status={chop:'Taking axe…',plow:shovel?.tier>=2?`Taking ${shovel.short} shovel…`:'Taking hoe…',clear_weeds:shovel?.tier>=2?`Clearing weeds with your ${shovel.short} shovel…`:'Clearing the weeds…',dig_stump:shovel?.tier>=2?`Digging the stump out with your ${shovel.short} shovel…`:'Digging out the stump…',dig_mud:shovel?.tier>=2?`Scooping mud with your ${shovel.short} shovel…`:'Digging up mud…',pick_apples:'Picking apples…',plant:'Planting a seed…',water:'Watering…',harvest:'Gathering your harvest…'}[order.type];
    if(order.type==='chop'){
      this.fallingId=order.id;this.workTree=this.asset(`tree_${order.tree.species}`);this.workTree.position.copy(nativePosition(order.tree.position));this.workTree.scale.set(order.tree.scale[0],order.tree.scale[2],order.tree.scale[1]);this.scene.add(this.workTree);this.refreshDynamic();
    }if(order.type==='mine')this.mining.begin(this.action);if(['eat','fish','rest','sleep','grill','pray'].includes(order.type))this.nutrition.begin(this.action);if(order.type==='build')this.building.begin(this.action);this.notify();
  }
  finishAction() {
    const a=this.action;if(!a)return;
    this.livingTest?.actions.clear(a);
    const nutritionAction=['eat','fish','rest','sleep','grill','pray'].includes(a.type);
    try{
      if(a.type==='build')this.building.finish(a);
      if(nutritionAction)this.nutrition.finish(a);
      const previous=this.store.state;if(a.type!=='chop'&&a.type!=='mine'&&a.type!=='build'&&a.type!=='dine'&&!nutritionAction)this.store.commit(a);if(previous!==this.store.state){
        const gained=woodTotal(this.store.state)-woodTotal(previous);this.status={chop:`+${gained} ${label(a.tree?.species||'')} wood · +1 seed${gained<3?' · extra logs wait here':''}`,plow:'Your garden spot is ready! Choose Plant to add a seed.',clear_weeds:'Weeds cleared! This spot is ready to plant.',dig_stump:'Stump dug out! The ground is clear.',dig_mud:`+1 mud · ${this.store.state.inventory.mud||0} in the bag`,pick_apples:`+${APPLES_PER_PICK} apples · ${this.store.state.inventory.apple||0} in the bag`,plant:`${SEEDS.find(s=>s.id===a.seed)?.name} planted. Water it or it will not grow.`,water:'Watered · it is growing again.',harvest:'Crops picked! +3 crops and +1 seed'}[a.type];this.toast(this.status);
        const fx=a.type==='harvest'?'harvest':a.type==='plant'?'plant':null;if(fx)this.music?.sfx?.play(fx);
      }
    }catch(e){this.toast(e.message);}
    if(a.type==='pick_apples')this.pinJob=null;
    if(a.type==='chop'||a.type==='mine')this.touchResourceHealth(a.type==='chop'?'tree':'rock',a.id);if(a.type==='mine')this.mining.end(a);if(nutritionAction)this.nutrition.clear();if(this.workTree){this.scene.remove(this.workTree);this.workTree=null;}this.fallingId=null;this.action=null;Object.values(this.tools).forEach(t=>t.visible=false);this.refreshDynamic();this.persist();this.autoWork?.onFinish(a);this.notify();
  }
  strikeTree(a){
    try{
      if(this.nutrition&&!this.nutrition.check('chop_hit')){a.failed=true;return;}
      const before=this.store.state;this.store.commit({type:'chop_hit',id:a.id,actionId:`${a.gatherId}:${a.hits}`});
      if(this.store.state===before){a.failed=true;this.toast('This tree could not be hit. Check your wood space and try again.');return;}
      this.music?.sfx?.play('chop');if(a.impactPoint)emitChopChips(this,a.impactPoint);else this.burst(a.target,'wood',.95);this.touchResourceHealth('tree',a.id);a.broken=treeRemaining(a.tree,this.store.state)===0;
      this.status=`Chopping · ${treeRemaining(a.tree,this.store.state)} / ${TREE_MAX_HEALTH} health left`;
      if(a.broken){const gained=woodTotal(this.store.state)-woodTotal(before);a.reward=`+${gained} ${label(a.tree.species)} wood · +1 seed${gained<3?' · extra logs wait here':''}`;this.status=a.reward;this.toast(a.reward);}
      this.notify();
    }catch(e){a.failed=true;this.toast(e.message);}
  }
  stopGathering(){
    const work=this.action||this.order;if(!work||!['chop','mine'].includes(work.type)||work.broken)return false;
    if(this.action){this.action.cancelled=true;this.finishAction();}else{this.touchResourceHealth(work.type==='chop'?'tree':'rock',work.id);this.order=null;this.path=[];this.marker.visible=false;this.persist();}
    this.building.clearPlan=null;this.status='Stopped for now. Every completed hit is saved.';this.toast(this.status);this.notify();return true;
  }
  touchResourceHealth(kind,id,wall=Date.now()){this.resourceTarget={kind,id,until:wall+8000};}
  resourceHealthSnapshot(wall=Date.now()){
    const target=this.resourceTarget;if(!this.loaded||!target||this.mapOnly||this.overview)return null;
    const work=this.action||this.order,working=!!work&&work.id===target.id&&['chop','mine'].includes(work.type);
    if(!working&&wall>target.until)return null;
    let node,position,name,health;
    if(target.kind==='rock'){
      node=this.mining.nodes.get(target.id);if(!node)return null;position=node.bounds.getCenter(V());position.y=node.bounds.max.y+.65;name=node.profile.name;health=resourceHealth(rockRemaining(node.rock,this.store.state),node.profile.maxHealth);
    }else{
      const tree=(this.allTrees||this.world.trees).find(t=>t.id===target.id)||work?.tree;if(!tree)return null;position=nativePosition(tree.position).add(V(0,2.7,0));name=`${label(tree.species)} tree`;health=resourceHealth(treeRemaining(tree,this.store.state),TREE_MAX_HEALTH);
    }
    const p=position.project(this.camera),rect=this.renderer.domElement.getBoundingClientRect(),w=rect.width,h=rect.height;
    if(p.z< -1||p.z>1||Math.abs(p.x)>1.15||Math.abs(p.y)>1.15)return null;
    return {...target,...health,name,working,canStop:working&&!health.broken,screen:{x:Math.max(104,Math.min(w-172,(p.x+1)/2*w)),y:Math.max(110,Math.min(h-150,(1-p.y)/2*h))}};
  }
  ik(side,target) {
    const bones=[this.bones[`mixamorig${side}ForeArm`],this.bones[`mixamorig${side}Arm`]],hand=this.bones[`mixamorig${side}Hand`];if(!hand)return;
    this.solveChain(bones,hand,target);
  }
  solveChain(bones,endBone,target) {
    for(let k=0;k<14;k++)for(const bone of bones){if(!bone)continue;const at=bone.getWorldPosition(V()),end=endBone.getWorldPosition(V()),u=end.sub(at).normalize(),v=target.clone().sub(at).normalize();if(!Number.isFinite(u.x)||u.lengthSq()<.1)continue;const dq=Q().setFromUnitVectors(u,v),worldQ=bone.getWorldQuaternion(Q()).premultiply(dq),parentQ=bone.parent.getWorldQuaternion(Q()).invert();bone.quaternion.copy(parentQ.multiply(worldQ));bone.updateWorldMatrix(false,true);}
  }
  localPoint(p){return this.actor.localToWorld(V(...p));}
  animateWork(dt) {
    dt*=actionPlaybackRate(this.action.type);
    if(this.livingTest&&['plant','water','harvest'].includes(this.action.type)){this.livingTest.actions.animate(this.action,dt);return;}
    if(['eat','fish','rest','sleep','grill','pray'].includes(this.action.type)){this.nutrition.animate(dt);return;}
    if(this.action.type==='mine'){this.mining.animate(dt);return;}
    if(this.action.type==='build'){this.building.animate(dt);return;}
    if(this.action.type==='dine'){this.dining.animatePlayer(dt);return;}
    if(['chop','plow','clear_weeds','dig_stump','dig_mud'].includes(this.action.type)){animateGathering(this,dt);return;}
    if(this.action.type==='pick_apples'){const a=this.action;a.t+=dt*this.animationRate;const t=a.t,duration=2.0,reach=smooth(Math.sin(Math.PI*Math.min(1,t/duration)));this.actor.rotation.y=Math.atan2(a.target.x-this.player.x,-(a.target.y-this.player.y));this.actor.updateMatrixWorld(true);this.ik('Right',this.localPoint([-.22,1.15+reach*.7,.25+reach*.45]));this.ik('Left',this.localPoint([.3,1.0+reach*.25,.2]));if(t>.9&&!a.hits){a.hits=1;this.burst({x:a.target.x,y:a.target.y},'seed',1.6);}if(t>=duration)this.finishAction();return;}
    const a=this.action;a.t+=dt*this.animationRate*(this.nutrition?.workRate?.()??1);const t=a.t,duration=a.type==='water'?2.2:1.85;
    const tool=this.tools[a.type==='water'?'watering_can':a.type==='harvest'?'sickle':'seed_pouch'];tool.visible=true;
    const p=smooth(Math.sin(Math.PI*Math.min(1,Math.max(0,(t-.48)/(duration-.48))))),wrist=[-.25,1.2-p*.28,.25+p*.28],head=a.type==='water'?[.25,.5,.9]:[-.05,.25,.9];
    if(t>.95&&!a.hits){a.hits=1;this.burst(a.target,a.type==='water'?'water':'seed',.15);}
    const feet=['Right','Left'].map(side=>{const foot=this.bones[`mixamorig${side}Foot`];return {side,foot,position:foot.getWorldPosition(V()),quaternion:foot.getWorldQuaternion(Q())};});
    const bend=smooth((t-.4)/.35);this.bones.mixamorigHips.position.y-=.09*bend;this.bones.mixamorigSpine?.rotateX(.18*bend);this.actor.updateMatrixWorld(true);
    for(const f of feet){this.solveChain([this.bones[`mixamorig${f.side}Leg`],this.bones[`mixamorig${f.side}UpLeg`]],f.foot,f.position);f.foot.quaternion.copy(f.foot.parent.getWorldQuaternion(Q()).invert().multiply(f.quaternion));f.foot.updateWorldMatrix(false,true);}
    this.ik('Right',this.localPoint(wrist));this.actor.updateMatrixWorld(true);
    const grip=this.bones.mixamorigRightHand.localToWorld(V(0,.065,0)),c=tool.userData.contact_local||[.3,.72,0],contact=V(c[0],c[2],-c[1]);
    tool.position.copy(grip);tool.quaternion.setFromUnitVectors(contact.normalize(),this.localPoint(head).sub(grip).normalize());
    this.ik('Left',this.localPoint([.36,1.02,.2]));if(t>=duration)this.finishAction();
  }
  burst(target,kind,height) {
    for(let i=0;i<12;i++){const mesh=new THREE.Mesh(this.particleGeometry,this.particleMaterials[kind]);mesh.position.set(target.x,heightAt(this.world,target.x,target.y)+height,-target.y);mesh.scale.setScalar(.7+Math.random());this.scene.add(mesh);this.particles.push({mesh,life:.8,v:V((Math.random()-.5)*2,1+Math.random()*2,(Math.random()-.5)*2)});}
  }
  persist(){if(!this.store||this.store.locked)return;this.livingTest?.save();try{this.store.persistPlayer(this.player);}catch(e){this.toast(e.message);}}
  toast(text,ms){if(!text)return;const item={text,id:Date.now()+Math.random(),...(ms?{ms}:{})};this.toastQueue??=[];if(this.toasts?.length)this.toastQueue.push(item);else{this.toasts=[item];this.toastUntil=performance.now()+(item.ms||2800);}this.notify();}
  drainToasts(){if(!this.toasts?.length||performance.now()<(this.toastUntil||0))return;const next=this.toastQueue?.shift();this.toasts=next?[next]:[];if(next)this.toastUntil=performance.now()+(next.ms||2800);this.notify();}
  pullFarmToasts(){this.feedMorning();const pending=this.store?.state?.farm?.pendingToasts;if(!pending?.length||!this.store||this.store.locked)return;const next=structuredClone(this.store.state),lines=next.farm.pendingToasts.splice(0,next.farm.pendingToasts.length);try{this.store.save(next);}catch(e){this.toast(e.message);return;}for(const line of lines)this.toast(line);}
  /** Night and dawn lines (fencing.mjs farmNightfall/farmDawn, bundled into farm.morning) go to the island feed once per day, keyed by day so a reload never repeats them. */
  feedMorning(){const m=this.store?.state?.farm?.morning;if(!m||m.dismissed||m.day===this._fedMorningDay)return;this._fedMorningDay=m.day;try{(m.lines||[]).forEach((line,i)=>{if(!line||/^quiet night/i.test(line))return;noteEvent(/coyote|chased|guard|fence/i.test(line)?'night':'dawn',/[.!]$/.test(line)?line:`${line}.`,{id:`morning:${m.day}:${i}`});});}catch{/* feed is best-effort */}}
  dismissMorning(){const report=this.store?.state?.farm?.morning;if(!report||report.dismissed||!this.store||this.store.locked)return;const next=structuredClone(this.store.state);next.farm.morning={...next.farm.morning,dismissed:true};try{this.store.save(next);}catch(e){this.toast(e.message);return;}this.notify();}
  previewTime(kind){const target=kind==='dusk'?420+900*530/590:1320;const current=gameTime(this.store.state);this.clockChange(Math.floor(current/1440)*1440+target-current,false);this.community.step({active:true});this.syncNight();this.notify();}
  clockChange(delta,pause){if(!this.store)return;try{this.store.clockChange(delta,pause);this.refreshDynamic();this.animals?.sync();this.pullFarmToasts();this.notify();}catch(e){this.toast(e.message);}}
  reset(undo=false){if(this.action)return;try{undo?this.store.undoReset():this.store.reset();this.store.enableNightCycle();this.player={...this.store.state.player};this.nutrition?.clear();this.building?.clearWork();this.building?.cancelPreview();this.path=[];this.order=null;this.animationRate=1;this.zoom=19;this.overview=false;this.resize();this.refreshDynamic();this.toast(undo?'Previous test restored.':'Fresh test started. You can restore the previous test.');}catch(e){this.toast(e.message);}}
  setAnimationRate(value){this.animationRate=value;this.notify();}
  toggleMap(){this.overview=!this.overview;this.refreshDynamic();this.resize();this.notify();}
  toggleClose(){this.stepZoom(this.zoom<14?1:-1);}
  touchSpan(e){const a=e.touches[0],b=e.touches[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
  /** Two fingers landed. Cancel the one-finger turn so the pinch cannot also walk or spin. */
  armPinch(e){
    this.mapGesture.cancel();this.pinching=true;
    const dist=this.touchSpan(e);if(!(dist>12))return;
    const inn=this.interior,inside=inn?.phase==='inside';
    if(inside&&inn.homeZoom==null)inn.homeZoom=inn.camTo?.zoom??this.zoom;
    const map=this.mapOnly&&this.overview,blocked=!inside&&!map&&(!!inn||this.overview||this.mapOnly||!!this.fishing?.firstPerson);
    this.pinch={dist,zoom:map?this.currentMapSpan():this.zoom,mode:blocked?'blocked':inside?'inside':map?'map':'outside',id:inside?inn.id:null};
  }
  movePinch(e){
    const p=this.pinch;if(!p||p.mode==='blocked')return;
    const dist=this.touchSpan(e);if(!(dist>12)||!(p.dist>12))return;
    const inn=this.interior;
    if(p.mode==='inside'){if(!inn||inn.phase!=='inside'||inn.id!==p.id){p.mode='blocked';return;}}
    else if(p.mode==='map'){if(!this.mapOnly||!this.overview){p.mode='blocked';return;}}
    else if(inn||this.overview||this.mapOnly||this.fishing?.firstPerson){p.mode='blocked';return;}
    // Fingers apart (pinch out) = closer = a smaller vertical span.
    this.setZoomSpan(p.zoom*(p.dist/dist));
  }
  endPinch(){this.pinch=null;this.pinching=false;}
  /**
   * Ortho vertical span in metres. Smaller is closer.
   * Outside play stays between 8 and 28. Inside, the span stays near the room
   * framing and never overwrites the outside zoom saved for the Outside button.
   */
  setZoomSpan(next){
    if(!Number.isFinite(next)||this.fishing?.firstPerson)return;
    const inn=this.interior;
    if(this.mapOnly&&this.overview){const w=this.container.clientWidth||800,h=this.container.clientHeight||600,full=overviewSpan(this.viewYaw||0,w/h);this.mapSpan=THREE.MathUtils.clamp(next,18,full);this.updateProjection();return;}
    if(inn){
      if(inn.phase!=='inside')return;
      const base=inn.homeZoom??inn.camTo?.zoom??this.zoom;
      if(inn.homeZoom==null)inn.homeZoom=base;
      const zoom=THREE.MathUtils.clamp(next,base*0.72,base*1.32);
      inn.camFrom.zoom=zoom;inn.camTo.zoom=zoom;this.zoom=zoom;this.updateProjection();return;
    }
    if(this.siteView){this.zoom=THREE.MathUtils.clamp(next,16,96);this.updateProjection();return;}
    if(this.overview||this.mapOnly)return;
    this.zoom=THREE.MathUtils.clamp(next,8,28);this.updateProjection();
  }
  /** dir -1 steps closer, +1 steps farther. */
  stepZoom(dir){
    const toward=dir<0?-1:1,pick=(stops,current)=>{
      if(toward<0){for(let i=stops.length-1;i>=0;i--)if(stops[i]<current-.05)return stops[i];return stops[0];}
      for(const z of stops)if(z>current+.05)return z;return stops[stops.length-1];
    };
    const inn=this.interior;
    if(inn?.phase==='inside'){
      const base=inn.homeZoom??inn.camTo?.zoom??this.zoom;
      if(inn.homeZoom==null)inn.homeZoom=base;
      this.setZoomSpan(pick([base*.78,base,base*1.22],this.zoom));this.notify();return;
    }
    if(this.mapOnly||inn)return;
    if(this.overview)this.overview=false;
    this.setZoomSpan(pick([8,13,19,24,28],this.zoom));this.notify();
  }
  /** One Zoom button: each tap steps closer; from the closest stop it jumps back out to the farthest. Pinch covers the rest. */
  cycleZoom(){
    if(this.mapOnly||this.fishing?.firstPerson)return;
    const inn=this.interior;
    if(inn){
      if(inn.phase!=='inside')return;
      const base=inn.homeZoom??inn.camTo?.zoom??this.zoom;
      if(this.zoom<=base*.78+.05){this.setZoomSpan(base*1.22);this.notify();return;}
      this.stepZoom(-1);return;
    }
    if(!this.overview&&this.zoom<=8.05){this.setZoomSpan(28);this.notify();return;}
    this.stepZoom(-1);
  }
  /** Abandon the current action without banking it (switching bodies, leaving the island). Sleep is never dropped here. */
  dropAction(){
    const a=this.action;if(!a||a.type==='sleep')return;
    if(a.type==='mine')this.mining.end(a);if(a.type==='fish'&&this.fishing?.active)this.fishing.leave();
    if(a.type==='pray'){this.prayer=null;this.nutrition?.hushPrayer();}
    this.action=null;this.nutrition?.clear();this.building?.clearWork?.();if(this.workTree){this.scene.remove(this.workTree);this.workTree=null;}this.fallingId=null;Object.values(this.tools).forEach(t=>t.visible=false);
    this.pinJob=null;this.releasePose();
    this.path=[];this.order=null;this.marker.visible=false;this.notify();
  }
  syncNight(){
    const night=!!this.store.state.night;if(night===!!this.nightVisual)return;this.nightVisual=night;this.keys.clear();this.path=[];this.order=null;this.manualMoving=false;this.marker.visible=false;
    this.livingTest?.garden.cancel();this.livingTest?.actions.clear();
    if(this.action?.type==='mine')this.mining.end(this.action);this.action=null;this.nutrition.clear();this.building.clearWork();this.building.cancelPreview();if(this.workTree){this.scene.remove(this.workTree);this.workTree=null;}this.fallingId=null;Object.values(this.tools).forEach(t=>t.visible=false);if(this.fishing?.active)this.fishing.leave();if(this.autoWork?.active)this.autoWork.stop(true);
    this.player={...this.store.state.player};for(const h of Object.values(this.community?.actors||{}))h.actor.visible=!night&&!this.playersOnly;if(this.playersOnly)this.community?.hideBuiltIns();if(!night){this.livingTest?.applyFriendVisibility();this.refreshDynamic();}this.animals?.sync();this.notify();
  }
  lighting(dt) {
    this.animateWater(dt);
    const day=islandLight(this.store.state.clock,Date.now()).daylight;this.daylight=day;const d=day;
    this.sun.intensity=.26+d*2.61;this.hemi.intensity=.56+d*1.77;this.nightSky?.update(dt,d,(this.fishing?.firstPerson?this.fishing.camera:this.camera).position);if(this.nightSky){this.sun.color.copy(this.nightSky.sunColor);this.hemi.color.copy(this.nightSky.sky1).lerp(new THREE.Color('#adc3e3'),.5);}else{this.sun.color.setRGB(1,.78+d*.13,.62+d*.16);this.hemi.color.set('#adc3e3');}this.lantern.intensity=0;
    this.coastalLook?.update(dt,d);
    this.placeSun();
  }
  /**
   * The sun slides with the player every frame on every device, so the shadow map is rebuilt in
   * step with the bodies that cast into it. (A throttled iPad update left shadows hopping a few
   * times a second behind the walk; the per-frame cost is covered by the plain PCF filter instead.)
   */
  placeSun(){
    const view=this.viewPoint(),x=view.x,y=view.y;
    this.sun.position.set(x+SUN_OFFSET.x,SUN_OFFSET.y,-y+SUN_OFFSET.z);this.sun.target.position.set(x,heightAt(this.world,x,y),-y);
    this.fitShadow();
  }
  /**
   * Fit the sun's orthographic shadow box to what the camera can see: the four screen corners dropped onto
   * the ground plane, each also lifted by SHADOW_CASTER_HEIGHT so trees and roofs standing on visible ground
   * still cast, projected onto the light's fixed axes and padded. Overview, missed corners, or a camera that
   * sees past the clamp fall back to the full ±SHADOW_HALF box. Uses the previous frame's camera matrix
   * (one frame of lag is well inside the padding).
   */
  fitShadow(){
    const sc=this.sun.shadow.camera,eye=this.sun.position;
    let l=-SHADOW_HALF,r=SHADOW_HALF,b=-SHADOW_HALF,t=SHADOW_HALF;
    const cam=this.fishing?.firstPerson?this.fishing.camera:this.camera;
    if(!this.overview&&cam){
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,ok=true;
      for(const [nx,ny] of SHADOW_CORNERS){
        _shadowRay.setFromCamera(_shadowNdc.set(nx,ny),cam);
        if(!_shadowRay.ray.intersectPlane(this.groundPlane,_shadowHit)){ok=false;break;}
        for(let k=0;k<2;k++){
          _shadowP.copy(_shadowHit);_shadowP.y+=k*SHADOW_CASTER_HEIGHT;_shadowP.sub(eye);
          const px=_shadowP.dot(SUN_X),py=_shadowP.dot(SUN_Y);
          if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;
        }
      }
      if(ok){
        l=Math.max(-SHADOW_HALF,minX-SHADOW_PAD);r=Math.min(SHADOW_HALF,maxX+SHADOW_PAD);
        b=Math.max(-SHADOW_HALF,minY-SHADOW_PAD);t=Math.min(SHADOW_HALF,maxY+SHADOW_PAD);
        if(!(r-l>2&&t-b>2)){l=-SHADOW_HALF;r=SHADOW_HALF;b=-SHADOW_HALF;t=SHADOW_HALF;}
      }
    }
    if(Math.abs(sc.left-l)>.05||Math.abs(sc.right-r)>.05||Math.abs(sc.bottom-b)>.05||Math.abs(sc.top-t)>.05){sc.left=l;sc.right=r;sc.bottom=b;sc.top=t;sc.updateProjectionMatrix();}
  }
  /**
   * Skinned clips advance once per animation frame. On iPad that step is the real frame delta
   * (capped at 250 ms so a hidden tab does not fast-forward). A second call in the same tick is ignored.
   */
  stepMixer(mixer,dt){
    if(!mixer||mixer._hwFrame===this.frameSerial)return;
    mixer._hwFrame=this.frameSerial;
    mixer.update(this.ipadQuality&&this.frameDt>0?Math.min(this.frameDt,.25):dt);
  }
  /** The island's own to-do list (see island-plan.js). */
  plan(){return planFor(this);}
  /**
   * Players World with nobody to play as yet: the island boots with the hidden default Adam body until a
   * story friend is dropped off. While `ambient`, the world is look-only — pan and zoom work, but walking,
   * tools and jobs wait for a friend, so a kid never steers an invisible character.
   */
  get ambient(){return !!(this.playersOnly&&this.loaded&&!this.actor?.userData?.residentId);}
  /** Story friends work on their own once the child has welcomed someone ashore. */
  get helpersLive(){return this.playersOnly||!!(this.livingTest?.state?.welcomeSeen&&this.livingTest?.state?.adamUnlocked);}
  /** Say once in a while why nothing happens; returns true when play is blocked. */
  ambientNudge(){if(!this.ambient)return false;const now=Date.now();if(!(now<(this.ambientNudgedAt||0)+4000)){this.ambientNudgedAt=now;this.toast('Drop off a story friend first. Tap Friends to bring one ashore.');}return true;}
  /** What the island is working towards (a building kind), kept per device. */
  get goal(){try{const v=JSON.parse(localStorage.getItem(GOAL_KEY)||'null');return v?.kind&&buildingById(v.kind)?v:null;}catch{return null;}}
  setGoal(kind){if(!buildingById(kind))return;localStorage.setItem(GOAL_KEY,JSON.stringify({kind,at:Date.now()}));this.toast(`Goal set: build a ${buildingById(kind).name}!`);this.notify();}
  clearGoal(){localStorage.removeItem(GOAL_KEY);this.notify();}
  /** Profile-scoped Friends World coins. Separate from story and mini-game rewards. */
  coinBalance(){return displayCoins(this.coins);}
  /** Green-dot work: a live chore, a job, building duty, or a meal. Asleep and idle stay quiet. */
  friendActivity(actor){
    const home=actor?.userData||{};
    const id=home.residentId;
    const s=this.store?.state;
    const asleep=!!(s?.night||s?.characters?.[id]?.sleep);
    const task=this.liveTask(actor,asleep);
    if(asleep)return {working:false,asleep:true,task};
    const dining=this.dining;
    const atMeal=!!(dining&&(dining.grill?.actor===actor||dining.owns?.(actor)));
    const playing=actor===this.actor&&(!!this.action||!!this.order||!!this.autoWork?.active);
    const working=!!(home.chore||home.job||home.onDuty||atMeal||playing);
    return {working,asleep:false,task};
  }
  /** The specific thing this friend is doing right now, in the foreman's own words. */
  liveTask(actor,asleep){
    const home=actor?.userData||{};
    if(asleep)return 'Sleeping';
    const dining=this.dining;
    if(dining?.grill?.actor===actor)return 'Grilling the fish';
    const stage=dining?.routine?.stage;
    if(dining?.cookActor?.()===actor&&(stage==='fishing'||stage==='gather'))return 'Fishing for the meal';
    if(dining?.cookActor?.()===actor&&stage==='picking')return 'Picking food for the recipe';
    if(dining?.cookActor?.()===actor&&stage==='ready')return 'Ringing everyone to eat';
    if(dining?.owns?.(actor))return 'Eating with everyone';
    if(home.onDuty){
      const id=home.residentId||home.id;
      const site=(this.store?.state?.buildings||[]).find(b=>b?.project&&b.status!=='complete'&&(b.project.crew||[]).includes(id));
      const name=site&&buildingById(site.kind)?.name;
      if(name)return site.upgradeFrom?`Upgrading into a ${name}`:`Raising the ${name}`;
      return 'Hammering with the crew';
    }
    const label=home.chore?.label||home.job?.label;
    if(label)return home.chore?.path?.length?`On the way to ${label.charAt(0).toLowerCase()}${label.slice(1)}`:label;
    if(actor===this.actor){
      const t=this.action?.type;
      const words={pray:'Praying',fish:'Fishing',chop:'Chopping wood',chop_hit:'Chopping wood',rest:'Resting',cook:'Making a recipe',eat:'Having a snack',mine:'Breaking rocks',plant:'Planting seeds',water:'Watering the garden',harvest:'Picking the crop'};
      if(t&&words[t])return words[t];
      if(this.order?.type==='build')return 'Walking to a building';
      if(this.autoWork?.active)return this.autoWork.snapshot?.()?.label||'Working';
    }
    if(home.strollState?.path?.length)return 'Taking a walk';
    const energy=this.store?.state?energyFor(this.store.state,home.residentId||home.id):99;
    if(energy<=15)return 'Resting';
    return 'Waiting for the next job';
  }
  /** Fence and plots from the garden keeper when it has read the garden. */
  gardenSnap(){
    const st=this.gardenKeeper?.status;
    if(st)return {fencedPct:st.fencedPct||0,plots:st.plots||0,planted:st.planted||0};
    return null;
  }
  /** One large goal per friend ashore, plus the single extra the kid may have added today. */
  todayCard(){
    const s=this.store?.state;if(!s)return {day:1,friends:[],extra:null,choices:[],meter:null,feed:[]};
    const project=this.village?.plan()?.goal||null;
    const order={eve:0,noah:1,adam:2,abel:3};
    const friends=this.crew().map(c=>{
      const actor=this.residents?.models?.get(c.id);
      return {...c,...(actor?this.friendActivity(actor):{working:false,asleep:false,task:'Waiting to come ashore'}),goal:displayGoal(s,c.id,c.name),options:optionsFor(c.name,project)};
    }).sort((a,b)=>(order[characterKey(a.name)]??50)-(order[characterKey(b.name)]??50)||a.name.localeCompare(b.name));
    const bag=todayBag(s);
    const feed=readFeed().slice(-6).reverse().map(e=>({id:e.id,text:e.text}));
    return {day:bag.day,friends,extra:bag.extra,choices:addChoices(project),meter:journeyMeter(s,this.gardenSnap(),project),feed};
  }
  /** Write today's goals into the island save and, when the extra is a building, point the settlement at it. */
  _saveGoals(bag,pinKind,unpinKind){
    const s=this.store.state;
    this.store.save({...s,village:withToday(s.village,bag)});
    if(pinKind&&buildingById(pinKind))localStorage.setItem(GOAL_KEY,JSON.stringify({kind:pinKind,at:Date.now()}));
    else if(unpinKind){try{const cur=JSON.parse(localStorage.getItem(GOAL_KEY)||'null');if(cur?.kind===unpinKind)localStorage.removeItem(GOAL_KEY);}catch{/* leave the build goal */}}
  }
  /** Drop the helper's current background chore so the new goal can start. A job the kid handed them stays. */
  releaseFriend(id){
    const actor=this.residents?.models?.get(id);if(!actor)return;
    const home=actor.userData;
    if(this.dining?.grill?.actor===actor)this.dining.stopGrill();
    if(home.job?.explicit)return;
    if(home.job)this.residents.stopJob(actor,false);
    else if(home.chore){this.residents.claims.delete(home.chore.key);home.chore=null;}
  }
  dismissFriendGoal(id){
    const s=this.store?.state;if(!s||!id)return;
    const prev=todayBag(s),next=dismissOverride(prev,id);
    try{this._saveGoals(next,null,prev.extra?.who===id?prev.extra.kind:null);}catch(e){this.toast(e.message);return;}
    this.releaseFriend(id);this.notify();
  }
  assignFriendGoal(id,choice){
    const s=this.store?.state;if(!s||!id||!choice)return;
    const prev=todayBag(s);
    const next=choice.foreman?setOverride(prev,id,null):setOverride(prev,id,choice);
    const pin=!choice.foreman&&choice.kind?choice.kind:null;
    const unpin=prev.extra?.who===id&&prev.extra.kind&&prev.extra.kind!==pin?prev.extra.kind:null;
    try{this._saveGoals(next,pin,unpin);}catch(e){this.toast(e.message);return;}
    this.releaseFriend(id);
    const who=this.residents?.models?.get(id)?.userData?.name||'Your friend';
    const title=choice.foreman?(GOALS[defaultGoalId(who)]?.title||'the foreman\'s goal'):(choice.title||GOALS[choice.id]?.title);
    this.toast(choice.foreman?`${who} is back on the foreman's goal.`:`${who}'s goal today: ${title}.`);
    this.notify();
  }
  addTodayGoal(choice){
    const s=this.store?.state;if(!s||!choice?.id||!GOALS[choice.id])return;
    const prev=todayBag(s);
    const {bag,who}=assignExtra(prev,this.crew(),choice);
    if(!who){this.toast('Drop off a friend first.');this.notify();return;}
    const unpin=prev.extra?.kind&&prev.extra.kind!==(choice.kind||null)?prev.extra.kind:null;
    try{this._saveGoals(bag,choice.kind||null,unpin);}catch(e){this.toast(e.message);return;}
    this.releaseFriend(who.id);
    if(prev.extra?.who&&prev.extra.who!==who.id)this.releaseFriend(prev.extra.who);
    this.toast(`${who.name}'s goal today: ${choice.title}.`);
    this.notify();
  }
  clearTodayGoal(){
    const s=this.store?.state;if(!s)return;
    const prev=todayBag(s);if(!prev.extra)return;
    try{this._saveGoals(clearExtra(prev),null,prev.extra.kind||null);}catch(e){this.toast(e.message);return;}
    this.releaseFriend(prev.extra.who);
    this.toast('The extra goal is off. The foreman chooses again.');
    this.notify();
  }
  /** Everyone living on the island right now; `active` is the body currently being played. */
  crew(){return [...(this.residents?.models?.values()||[])].map(a=>({id:a.userData.residentId,name:a.userData.name||'Friend',imageUrl:a.userData.imageUrl||'',active:a===this.actor}));}
  /** Hand a job to a specific friend: switch bodies if needed, then start the task. */
  assign(task,residentId){
    if(this.ambientNudge())return false;
    const actor=residentId?this.residents?.models?.get(residentId):null;
    // A friend you are not playing as runs simple jobs on their own, so several friends can work at once.
    if(actor&&actor!==this.actor&&this.residents.canHelp(task))return this.residents.assignJob(actor,task);
    if(actor&&actor!==this.actor){this.autoWork?.stop(true);if(this.action)this.unequipTool();this.residents.possess(actor);this.refreshDynamic?.();}
    return this.autoWork.start(task);
  }
  /** Spot every energy spend and queue a little sweat + "-N" flash by the character. */
  trackEnergy(now){
    const e=energyFor(this.store.state);
    if(this.lastEnergy==null){this.lastEnergy=e;return;}
    if(e<this.lastEnergy){this.energyFx=[...(this.energyFx||[]).filter(f=>now-f.at<1400),{id:now+Math.random(),delta:this.lastEnergy-e,at:now,side:Math.random()<.5?-1:1}];}
    else if(e>this.lastEnergy&&this.energyFx?.length){/* gains show elsewhere */}
    this.lastEnergy=e;
  }
  /** Tilled soil, a planted crop, or an empty garden slot the player can tap. */
  gardenPlot(key){
    const cell=this.store?.state.cells?.[key];
    if(cell?.soil||cell?.seed)return true;
    if(this.world?.gardenSlots?.some(s=>s.key===key))return true;
    return activeBuildings(this.store.state).some(b=>b.kind==='garden'&&b.status==='complete'&&footprint(this.world,b).keys.includes(key));
  }
  /** Tap a garden plot: growth info is brief; an empty prepared plot keeps its seed picker open longer. */
  peekPlant(key,now=performance.now()){
    const cell=this.store?.state.cells?.[key],picker=!!(cell?.soil&&!cell.seed&&!plotWeedy(cell,gameTime(this.store.state))),duration=picker?8000:2000;
    this.plantPeek={key,until:now+duration,duration};this.notify();
  }
  plantFromPeek(key,seed){
    const cell=this.store?.state.cells?.[key],choice=SEEDS.find(item=>item.id===seed);
    if(!choice||!cell?.soil||cell.seed||plotWeedy(cell,gameTime(this.store.state))||!(this.store.state.inventory?.[seed]>0)){this.plantPeek=null;this.toast('That seed is not available for this plot.');this.notify();return false;}
    this.plantPeek=null;this.seed=seed;return this.gardenAction('plant',key);
  }
  /** Open the garden card (garden-ui.jsx): fence status, what Abel is asking for, and the layout plan. */
  openGarden(){if(!this.building)return;this.building.openMenu={id:'garden',nonce:Date.now()};this.notify();}
  plantPeekSnapshot(now=performance.now()){
    const peek=this.plantPeek;if(!peek||now>peek.until||!this.loaded)return null;
    const s=this.store.state,cell=s.cells?.[peek.key],min=gameTime(s),g=growth(cell,min);
    const rect=this.renderer.domElement.getBoundingClientRect();if(!rect.width)return null;
    const p=cellFromKey(this.world,peek.key);this.camera.updateMatrixWorld(true);const pr=V(p.x,heightAt(this.world,p.x,p.y)+.9,-p.y).project(this.camera);if(pr.z<-1||pr.z>1)return null;
    const duration=peek.duration||2000,left=peek.until-now,opacity=left<300?Math.max(0,left/300):Math.min(1,(duration-left)/160);
    const x=Math.max(96,Math.min(rect.width-96,(pr.x+1)*rect.width/2)),y=Math.max(60,(1-pr.y)*rect.height/2);
    if(plotWeedy(cell,min))return {key:peek.key,empty:true,weeds:true,name:'Weeds',note:'Clear them before you can plant.',x,y,opacity};
    if(!g){
      const tilled=cell?.soil==='tilled';
      const seeds=cell?.soil?SEEDS.filter(seed=>(s.inventory?.[seed.id]||0)>0).map(seed=>({id:seed.id,name:seed.name,plant:seed.plant,count:s.inventory[seed.id]})):[];
      const half=Math.min(140,(rect.width-24)/2),pickerX=Math.max(half+12,Math.min(rect.width-half-12,(pr.x+1)*rect.width/2));
      return {key:peek.key,empty:true,picker:!!cell?.soil,name:tilled?'Choose a seed':'Plant this plot',note:seeds.length?'Tap a seed from your bag.':'No seeds in your bag.',seeds,x:cell?.soil?pickerX:x,y,opacity};
    }
    const stage={seeded:'Just planted',seedling:'Sprouting',growing:'Growing',ready:'Ready to pick!'}[g.stage];
    return {key:peek.key,name:g.seed.name,plant:g.seed.plant,stage,progress:g.progress,percent:Math.round(g.progress*100),thirsty:g.thirsty,ready:g.stage==='ready',remaining:g.progress<1?realDuration(g.remaining/60,s):null,x,y,opacity};
  }
  /** Floating progress timer over the campfire while a fish is grilling. */
  grillPeekSnapshot(){
    const a=this.action;if(!a||a.type!=='grill'||!this.loaded)return null;
    const rect=this.renderer.domElement.getBoundingClientRect();if(!rect.width)return null;
    const c=a.target;this.camera.updateMatrixWorld(true);const pr=V(c.x,heightAt(this.world,c.x,c.y)+1.3,-c.y).project(this.camera);if(pr.z<-1||pr.z>1)return null;
    const k=Math.min(1,a.t/a.duration),left=Math.max(0,a.duration-a.t);
    const recipe=RECIPES[a.recipe]||RECIPES.grill_fish,name=a.recipe==='dry_clay'?'Drying clay bricks':a.recipe==='bake_manna'?'Baking manna':'Grilling a fish',stageText=a.recipe==='dry_clay'?(k<.5?'By the fire':k<.9?'Hardening':'Almost dry!'):a.recipe==='bake_manna'?(k<.4?'In the oven':k<.85?'Rising':'Almost done!'):(k<.35?'Over the flames':k<.8?'Sizzling':'Almost done!');
    return {key:'grill',cook:true,name,plant:recipe.item,stage:stageText,progress:k,percent:Math.round(k*100),seconds:Math.ceil(left),remaining:null,thirsty:false,ready:k>=1,x:Math.max(90,Math.min(rect.width-90,(pr.x+1)*rect.width/2)),y:Math.max(60,(1-pr.y)*rect.height/2),opacity:Math.min(1,a.t/.2)};
  }
  /** Floating progress timers over every building under construction: percent, time left, who is on it and whether hunger slows them. */
  buildPeekSnapshot(wall=Date.now()){
    if(!this.loaded||this.overview||this.mapOnly||this.fishing?.firstPerson)return [];
    const s=this.store.state,sites=activeBuildings(s).filter(b=>['queued','building'].includes(b.status));if(!sites.length)return [];
    const rect=this.renderer.domElement.getBoundingClientRect();if(!rect.width)return [];
    const min=gameTime(s);this.camera.updateMatrixWorld(true);const out=[];
    for(const b of sites){
      const fp=footprint(this.world,b);if(!fp)continue;const def=buildingById(b.kind);
      const pr=V(fp.center.x,heightAt(this.world,fp.center.x,fp.center.y)+1.6,-fp.center.y).project(this.camera);if(pr.z<-1||pr.z>1||Math.abs(pr.x)>1.05||Math.abs(pr.y)>1.05)continue;
      const progress=buildingProgress(b,wall);let seconds=null,builders=[],slow=false,paused=false,blocked=null;
      if(b.project){
        const p=b.project;paused=!!p.paused;blocked=p.blocked||null;
        builders=p.crew.map(id=>{const w=p.workers[id],c=s.characters[id],rate=workRate(s,min,id);if(rate<1)slow=true;return {id,name:c?.name||id,rate,note:workRateNote(rate),phase:c?.sleep?'sleeping':w?.phase==='work'?'building':w?.phase==='rest'?'resting':['travel','rest_travel'].includes(w?.phase)?'walking':'waiting',you:id===s.activeCharacter};});
        const speed=builders.reduce((n,w)=>n+w.rate,0)*ACTIVE_FRACTION;
        if(!paused&&speed>0)seconds=Math.ceil((p.required-p.done)/speed);
      }else if(b.status==='building')seconds=Math.max(0,Math.ceil((1-progress)*def.seconds));
      out.push({id:b.id,name:def.name,progress,percent:Math.round(progress*100),seconds,builders,slow,paused,blocked,queued:b.status==='queued',x:Math.max(110,Math.min(rect.width-110,(pr.x+1)*rect.width/2)),y:Math.max(70,(1-pr.y)*rect.height/2)});
    }
    return out;
  }
  energyFxSnapshot(now=performance.now()){
    const fx=(this.energyFx||[]).filter(f=>now-f.at<1400);if(!fx.length||!this.loaded||this.overview||this.mapOnly||this.fishing?.firstPerson||!this.actor?.visible)return [];
    const rect=this.renderer.domElement.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return [];
    this.camera.updateMatrixWorld(true);const p=this.actor.getWorldPosition(V()).add(V(0,1.75,0)).project(this.camera);
    if(p.z<-1||p.z>1)return [];
    const x=(p.x+1)*w/2,y=(1-p.y)*h/2;
    return fx.map(f=>({id:f.id,delta:f.delta,t:(now-f.at)/1400,x,y,side:f.side}));
  }
  residentGreeting(){
    if(!this.playersOnly||!this.loaded||this.store?.state.night||this.mapOnly)return null;
    const actor=this.residents?.menuActor();
    const home=actor?.userData;
    if(!home?.residentId)return null;
    const energy=energyFor(this.store.state),min=gameTime(this.store.state);
    const inv=this.store.state.inventory||{},foodId=Object.keys(FOODS).filter(id=>inv[id]>0).sort((a,b)=>FOODS[b].energy-FOODS[a].energy)[0]||null;
    const helper=actor!==this.actor;const who=helper?home.residentId:undefined;const energyShown=helper?energyFor(this.store.state,home.residentId):energy;const hunger=Math.round(hungerFor(this.store.state,min,who));
    const card={name:home.name||'Friend',imageUrl:home.imageUrl||'',energy:energyShown,hunger,low:energyShown<=20||hunger<=25,canSleep:!helper&&completedHomes(this.store.state).length>0,canPray:!helper,actions:null,helper,work:helper?this.residents.jobSnapshot(home):(this.autoWork?.snapshot()||null),food:foodId?{id:foodId,name:FOODS[foodId].name,gain:mealGain(this.store.state,foodId,min,who).total}:null,foods:Object.keys(FOODS).filter(id=>inv[id]>0).sort((a,b)=>FOODS[b].energy-FOODS[a].energy).map(id=>{const m=mealGain(this.store.state,id,min,who);return {id,name:FOODS[id].name,count:inv[id],gain:m.total,energy:m.energy,hunger:m.hunger};}),hasRawFish:(inv.fish||0)>0};
    card.line=this.residents?.line?.residentId===home.residentId?this.residents.line:null;
    const rect=this.renderer.domElement.getBoundingClientRect(),w=rect.width,h=rect.height;
    if(!w||!h)return card;
    this.camera.updateMatrixWorld(true);actor.updateWorldMatrix(true,false);
    const p=actor.getWorldPosition(V()).add(V(0,2.35,0)).project(this.camera);
    if(p.z<-1||p.z>1)return card;
    card.actions={x:Math.max(78,Math.min(w-78,(p.x+1)*w/2)),y:Math.max(118,Math.min(h-24,(1-p.y)*h/2))};
    return card;
  }
  setMusic(on){this.music?.setOn(!!on);this.notify();}
  notify(){if(this.disposed)return;this.onUpdate({...this.snapshot(),livingTest:this.livingTest?.snapshot()||null});}
  snapshot(){
    if(!this.store)return {loaded:false,status:this.status,error:this.error};const s=this.store.state,minutes=gameTime(s),clock=timeLabel(minutes),phase=s.clock.cycle===1?dayPhase(s.clock,Date.now()):null;const plants=Object.entries(s.cells).filter(([,c])=>c.seed).map(([key,c])=>({key,...growth(c,minutes)}));
    return {loaded:!!this.loaded,playersOnly:!!this.playersOnly,helpersLive:!!this.helpersLive,ambient:this.ambient,music:this.music?this.music.on:true,status:this.status,error:this.error,saveError:this.store.error,savedAt:this.store.savedAt,tool:this.tool,seed:this.seed,state:s,clock,night:phase?{...phase,sleeping:!!s.night,remaining:s.night&&!phase.night?0:Math.max(0,Math.ceil(phase.remainingMs/1000))}:null,minutes,plants,wood:Object.entries(s.inventory).filter(([id])=>id.endsWith('_wood')).reduce((n,[,v])=>n+v,0),busy:!!this.action||!!this.order||!!s.characters[s.activeCharacter]?.sleep,toasts:this.toasts,overview:this.overview,sitePicking:!!this.siteView,animationRate:this.animationRate,labels:this.labels,mining:this.mining?.snapshot(),nutrition:this.nutrition?.snapshot(),report:this.store.state.reports?.at(-1)||null,unreadReport:this.store.state.reports?.findLast(r=>!r.read)||null,community:this.playersOnly?null:this.community?.snapshot(),building:this.building?.snapshot(),dining:this.dining?.snapshot()||null,reel:this.residents?.reelSnapshot?.()||null,diningCard:this.building?.openMenu?.id==='dining'?this.dining?.preview?.(this.building.openMenu.hallId)||null:null,fishing:this.fishing?.snapshot()||null,fishPrompt:(this.playersOnly||this.livingTestMode)&&!this.ambient?this.fishing?.prompt?.()||null:null,harvestPrompts:this.harvestPrompts(),snakePrompts:this.snakePrompts(),firePrompts:this.nutrition?.firePrompts?.()||[],prompt:this.promptSnapshot(),prayer:this.prayerSnapshot(),work:this.autoWork?.snapshot()||null,animals:this.animals?.snapshot()||null,friendsWaiting:this.residents?.waiting||null,arrival:this.arrivals?.snapshot()||null,stages:this.stages?.snapshot()||null,beds:this.residents?.bedStatus?.()||null,friends:this.residents?.roster?.()||[],recentTools:this.recentTools,campfire:this.nutrition?.campfireCard?.(this.building?.openMenu?.fireId)||null,oven:this.nutrition?.ovenCard?.(this.building?.openMenu?.ovenId)||null,well:this.nutrition?.wellCard?.(this.building?.openMenu?.wellId)||null,inside:this.interior?{name:this.interior.name,phase:this.interior.phase}:null,ui:this.ui||null,goal:this.goal,coins:Number.isFinite(this.coins)?this.coins:null,garden:this.gardenKeeper?.card()||null,farm:this.farmer?.snapshot()||null,market:this.stall?.card()||null,recipeBubble:this.kitchen?.card()||null,morning:s.farm?.morning&&!s.farm.morning.dismissed?s.farm.morning:null};
  }
  tick() {
    if(this.disposed)return;this.raf=requestAnimationFrame(this.tick);const frameDt=this.clock.getDelta(),dt=Math.min(.08,frameDt),now=performance.now();this.frameDt=frameDt;this.frameSerial=(this.frameSerial||0)+1;
    if(this.coopSceneOpen){this.livingTest?.farm?.update();if(now-this.lastRefresh>500){this.lastRefresh=now;this.notify();}return;}
    if(this.resolution){this.resolution.sample(frameDt,this.loaded&&!document.hidden);this.applyResolution();}
    if(this.loaded){
      this.mining?.settleForge();
      if(this.store.state.night){this.livingTest?.friend?.update(0);this.community?.update(dt);this.residents?.update(dt);this.dining?.update(dt);this.gardenKeeper?.update();this.buildAsk?.update();this.animals?.update(dt);this.syncNight();this.lighting(dt);this.drainToasts();if(now-(this.farmToastAt||0)>800){this.farmToastAt=now;this.pullFarmToasts();}if(now-this.lastRefresh>200){this.lastRefresh=now;this.notify();}this.renderer.render(this.scene,this.camera);return;}
      if(this.interior){this.keys.clear();this.path.length=0;this.order=null;if(this.marker) this.marker.visible=false;}
      const speed=moveCharacter(this,dt);
      this.actor.position.set(this.player.x,this.groundY(this.player.x,this.player.y)+.015,-this.player.y);
      if(this.residents?.waveActive()&&speed>0.08)this.residents.cancelWave();
      if(!this.path.length&&this.order&&!this.action)this.startAction(this.order);
      if(!this.path.length&&!this.order&&!this.action&&this.status==='Walking…'){
        if(this.marker)this.marker.visible=false;
        const idle={walk:'Tap land to walk. Open Actions to choose a tool.',axe:'Axe ready! Tap land to walk or a tree to chop.',mine:'Pickaxe ready! Tap land to walk or a rock to smash.',hoe:'Dig ready! Tap clear grass to dig, or weeds to clear a garden spot.',plant:'Seeds ready! Tap land to walk or an empty garden spot to plant.',water:'Watering can ready! Tap land to walk or a growing plant to water.',fish:'Rod ready! Tap land to walk or water to fish.'}[this.tool];
        if(idle)this.status=idle;
      }
      if(this.action){resetAnimatedPose(this);this.actor.updateMatrixWorld(true);this.animateWork(dt);}
      else if(this.residents?.waveActive())this.residents.stepWave(dt);
      else updateLocomotion(this,this.idlePose,dt,this.projectAdamWalking?WALK_SPEED:speed,Date.now()/1000);
      // Keep the original tools, construction and day cycle. The solo introduction
      // supplies its own goals until the child has welcomed their first friend.
      if(this.livingTestMode){this.lighting(dt);this.nutrition.update();this.building.update();this.community?.update(dt);this.residents?.update(dt);this.dining?.update(dt);this.kitchen?.update();this.village?.update();this.gardenKeeper?.update();this.farmer?.update();this.buildAsk?.update();this.animals?.update(dt);this.autoWork?.update(now);this.trackEnergy(now);this.syncNight();this.drainToasts();if(now-(this.farmToastAt||0)>800){this.farmToastAt=now;this.pullFarmToasts();}}
      else{this.lighting(dt);this.nutrition.update();this.building.update();this.community?.update(dt);this.residents?.update(dt);this.dining?.update(dt);this.kitchen?.update();this.village?.update();this.gardenKeeper?.update();this.farmer?.update();this.buildAsk?.update();this.stages?.update();this.animals?.update(dt);this.autoWork?.update(now);this.trackEnergy(now);this.syncNight();this.drainToasts();if(now-(this.farmToastAt||0)>800){this.farmToastAt=now;this.pullFarmToasts();}}
      this.livingTest?.update(dt,speed);
      if(this.livingTest?.friend?.chatOpen)this.livingTest.friend.camera(dt);
      else if(this.interior) this.building.stepInterior(dt);
      // iPad eases the camera with the real frame time, so a slow paint does not add extra trail. Phones and desktop keep the sim delta (capped at 80 ms).
      else if(this.siteView){this.camera.up.set(0,0,-1);this.camera.position.set(this.focus.x,80,this.focus.z);this.camera.lookAt(this.focus.x,0,this.focus.z);if(this.camera.near!==-80){this.camera.near=-80;this.camera.far=260;this.camera.updateProjectionMatrix();}}
      else{if(this.camera.up.y<0.9)this.camera.up.set(0,1,0);const preview=this.building.preview,fp=preview&&!preview.stroke?footprint(this.world,preview):null;const free=this.freeCamera();const target=free?null:fp?V(fp.center.x,this.building.ghostGroup.position.y-.7,-fp.center.y):this.overview?V(-2,0,-10):(this.livingTest?.watchActor()||this.residents?.watchActor()||this.community?.focusActor()||this.actor).position.clone().add(V(0,1,0));const followDt=this.ipadQuality?Math.min(frameDt,.5):dt;if(target)this.focus.lerp(target,1-Math.exp(-followDt*4));this.camera.position.copy(this.focus).add(V(...cameraOffset(this.viewYaw||0,this.overview,this.overview?0:this.viewPitch||0)));this.camera.lookAt(this.focus);if(this.camera.near!==-80){this.camera.near=-80;this.camera.far=260;this.camera.updateProjectionMatrix();}}
      this.livingTest?.arrival?.update(frameDt);
      this.livingTest?.garden?.updatePrompts();
      for(const p of this.particles){p.life-=dt;p.v.y-=dt*5;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*3;p.mesh.scale.multiplyScalar(1-dt*.6);if(p.life<=0)this.scene.remove(p.mesh);}this.particles=this.particles.filter(p=>p.life>0);
      if(now-this.lastRefresh>700){this.lastRefresh=now;const min=gameTime(this.store.state),sig=Object.entries(this.store.state.cells).flatMap(([key,c])=>{const g=c.seed?growth(c,min):null,bits=[];if(g)bits.push(`${key}:${g.stage}`);if(plotWeedy(c,min))bits.push(`${key}:weeds`);return bits;}).join('|');const view=this.viewPoint();if(sig!==this.fieldSignature.join('|')||dist(view,this.lastDrawPosition||{x:1e5,y:1e5})>6){this.refreshDynamic();this.lastDrawPosition={...view};}
        // Seeds often sit inside nav-blocked pockets (prop/tree padding), so the walker is stopped ~1 m short; reach past that so stepping up to a nut collects it.
        let changed=false;for(const seed of this.world.seeds){if(!this.store.state.pickedSeeds.includes(seed.id)&&dist(this.player,{x:seed.position[0],y:seed.position[1]})<Math.max(seed.radius||0,1.2)){try{this.store.commit({type:'pickup',id:seed.id});this.toast(`+${seed.quantity} ${label(seed.itemId)}`);changed=true;}catch(e){this.toast(e.message);break;}}}
        if(this.collectNearbyWood())changed=true;
        if(changed)this.refreshDynamic();
        const r=this.renderer.domElement.getBoundingClientRect();this.labels=this.trees.filter(t=>dist(this.player,{x:t.position[0],y:t.position[1]})<12).sort((a,b)=>dist(this.player,{x:a.position[0],y:a.position[1]})-dist(this.player,{x:b.position[0],y:b.position[1]})).slice(0,3).map(t=>{const p=nativePosition(t.position).add(V(0,3.6*t.scale[2],0)).project(this.camera);return {id:t.id,species:t.species,x:(p.x+1)/2*r.width,y:(1-p.y)/2*r.height,visible:Math.abs(p.x)<.85&&Math.abs(p.y)<.72};});this.mining.updateLabels(r);this.notify();
      }
      if(now-this.lastSave>5000){this.lastSave=now;if(!document.hidden)this.persist();}
    }
    this.renderer.render(this.scene,this.fishing?.firstPerson?this.fishing.camera:this.camera);
  }
  dispose(){this.coastalLook?.dispose();this.livingTest?.dispose();this.disposed=true;clearTimeout(this.friendTimer);this.assetAbort?.abort();this.draco?.dispose();this.music?.dispose();this.buildAsk?.dispose();this.residents?.dispose();this.animals?.dispose();this.farmer?.dispose();this.nightSky?.dispose();cancelAnimationFrame(this.raf);this.persist();this.observer.disconnect();this.mapGesture.dispose();this.renderer.domElement.removeEventListener('pointerdown',this.onStrokePointer);this.renderer.domElement.removeEventListener('pointermove',this.onStrokePointer);this.renderer.domElement.removeEventListener('touchstart',this.onCanvasTouchStart);this.renderer.domElement.removeEventListener('touchmove',this.onCanvasTouchMove);this.renderer.domElement.removeEventListener('touchend',this.onCanvasTouchEnd);this.renderer.domElement.removeEventListener('touchcancel',this.onCanvasTouchEnd);this.renderer.domElement.removeEventListener('gesturestart',this.blockGesture);this.renderer.domElement.removeEventListener('gesturechange',this.blockGesture);window.removeEventListener('blur',this.onBlur);window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);document.removeEventListener('visibilitychange',this.onHide);window.removeEventListener('pagehide',this.onUnload);window.removeEventListener('storage',this.onStorage);this.renderer.domElement.remove();}
}
