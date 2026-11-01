import {minutesAt,dayPhase,durationMilliseconds} from './island-clock.mjs';
import {advanceNightCycle,validNight} from './night-cycle.mjs';
// Gameplay coordinates are Blender metres (X/Y ground), independent of mesh faces.
import {selectCharacter} from './character-control.mjs';
import {prepareProject,advanceProjects} from './construction-projects.mjs';
import {CONSTRUCTION_BASIS,convertProjectTiming,projectPlan,crewStatus,defaultCrew,projectBuildings,projectWorkerPosition} from './project-rules.mjs';
import {reportBaseline,returnedReport} from './return-report.mjs';
import {TREE_MAX_HEALTH,treeRemaining,validTreeDamage} from './resource-health.mjs';
import {TOOL_TIERS,toolTier,rockProfile,upgradeStatus,normalizeTools,forgeJob,forgeProgress,hasForge} from './mining.mjs';
import {MAX_ENERGY,LOW_ENERGY,FOODS,FOOD_RECIPES,RECIPES,WATER_MAX,energyFor,setEnergy,energyCost,canCook,restGain,activeCharacter,sleepHome,canSleep,SLEEP_SECONDS,SLEEP_HOURS,MAX_HUNGER,hungerFor,setHunger,foodFill,mealGain,needsFood,isStarving,prayGain} from './nutrition.mjs';
import {SHOVEL_TIERS,shovelStatus,spendShovelRecipe,completedWells} from './digging.mjs';
import {HALL_KIND,planMeal} from './dining.mjs';
import {BUILD_ENERGY,buildingById,activeBuildings,collapsePrayerTents,completedFires,litFires,fireCanTakeLog,FIRE_LOG_MINUTES,heatSources,hotOvens,logMinutesFor,fireFuelLeft,buildingBlockers,footprint,workPoint,materialStatus,spendMaterials,siteStatus,buildingProgress,validBuildings,pointInBounds,upgradeDefinition,upgradeCost,upgradePlan,layerCount,addPaid,orientStrokeNeighbors,strokeNeed} from './building.mjs';
import {advanceCommunity,configureCommunity,validCommunity,communityClaim,homeReserved,memberPosition} from './community.mjs';
import {woodRoom,validWoodDrops} from './wood-storage.mjs';
import {validAnimals,animalSiteStatus} from './animals.mjs';
import {applyFarmSpan,dayIndex as farmDay,gardenFocus} from './fencing.mjs';
import {rememberResidentAction,rememberCompletedBuildings,nextResidentLine} from './resident-dialogue.mjs';
import {scopeKey,migrateLegacyKeys,adoptNewerLegacy} from './storage-scope.mjs';
import {creditSkill} from './settlement.mjs';
import {combine as combineRecipe,recipeById,sameStocks,recipeDay} from './recipes.mjs';
import {takeForSale} from './sell-prices.mjs';
import {fishingDockContains,fishingDockLayout} from './fishing-dock.mjs';
/** Island save. Per kid profile when the page URL carries `?profile=<scope>` (storage-scope.mjs); plain legacy key otherwise. */
export const SAVE_KEY_BASE = 'godlykids_homeworld_playtest_v1';
export const SAVE_KEY = scopeKey(SAVE_KEY_BASE);
export const GAME_MINUTES_PER_MS = 1440 / 600000;
export const SEEDS = [
  // waterDays: one watering keeps the plant growing this many island days; after that it waits, thirsty, until watered again.
  {id:'carrot_seed', name:'Carrot', plant:'carrot', hours:18, kind:'crop', icon:'🥕', color:'#e89739', waterDays:2},
  {id:'wheat_seed', name:'Wheat', plant:'wheat', hours:24, kind:'crop', icon:'🌾', color:'#dbb84b', waterDays:2},
  {id:'sunflower_seed', name:'Sunflower', plant:'sunflower', hours:36, kind:'crop', icon:'🌻', color:'#e8bf35', waterDays:3},
  {id:'pumpkin_seed', name:'Pumpkin', plant:'pumpkin', hours:48, kind:'crop', icon:'🎃', color:'#d9843b', waterDays:1},
  {id:'pine_seed', name:'Pine', plant:'pine', hours:72, kind:'tree', icon:'🌲', color:'#4d8050'},
  {id:'oak_acorn', name:'Oak', plant:'oak', hours:96, kind:'tree', icon:'🌳', color:'#72a34c'},
  {id:'maple_samara', name:'Maple', plant:'maple', hours:96, kind:'tree', icon:'🍁', color:'#b29b46'},
  {id:'apple_seed', name:'Apple', plant:'apple', hours:120, kind:'tree', icon:'🍎', color:'#a1ab3b'},
  {id:'coconut', name:'Coconut palm', plant:'coconut_palm', hours:144, kind:'tree', icon:'🌴', color:'#7e9c42'},
];
export const seedById = id => SEEDS.find(s=>s.id===id);
export const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const label = s => s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export function gameTime(state, wall=Date.now()) {
  return minutesAt(state.clock,state.clock.cycle===1?wall:Math.max(wall,state.clock.wall));
}
export function timeLabel(minutes) {
  const m=Math.floor(minutes)%1440;
  return {day:Math.floor(minutes/1440)+1, text:`${Math.floor(m/60)%12||12}:${String(m%60).padStart(2,'0')} ${m<720?'AM':'PM'}`,hour:m/60};
}
export function realDuration(hours,state) {
  const from=state?gameTime(state):0,seconds=Math.round(state?durationMilliseconds(state.clock,from,from+hours*60)/1000:hours/24*600), m=Math.floor(seconds/60),s=seconds%60;
  return `${m}m${s ? ` ${s}s` : ''}`;
}
/** Minutes one watering lasts for this seed (default 2 island days; trees are hardier). */
export const waterWindow=seed=>(seed.waterDays??(seed.kind==='tree'?3:2))*1440;
/** When this plant was last watered, or null if never. Old saves only carried a `watered` flag: treat it as watered at planting. */
const wateredAt=cell=>cell.wateredAt??(cell.watered?cell.plantedAt:null);
/**
 * Plants only grow while hydrated: `grown` banks the growing minutes earned before the last watering, and the
 * current watering adds minutes until its window runs out. A thirsty plant simply waits for the can.
 */
export function growth(cell,minutes) {
  const seed=seedById(cell?.seed);
  if(!seed) return null;
  const at=wateredAt(cell),window=waterWindow(seed),banked=cell.grown||0;
  const active=cell?.hold?0:(at==null?0:Math.max(0,Math.min(window,minutes-at)));
  const age=banked+active,thirsty=age<seed.hours*60&&(at==null||minutes-at>=window);
  const progress=Math.min(1,age/(seed.hours*60));
  return {seed,progress,age,thirsty,hydrated:!thirsty&&progress<1,wateredAt:at,remaining:Math.max(0,seed.hours*60-age),stage:progress>=1?'ready':progress>=.35?'growing':progress>=.12?'seedling':'seeded'};
}
/** True when a planted cell is wet right now (and not yet ready). */
export const hydrated=(cell,minutes)=>{const g=growth(cell,minutes);return !!g&&!g.thirsty;};
export function cellAt(world,x,y) {
  const col=Math.floor(x-world.grid.origin[0]),row=Math.floor(y-world.grid.origin[1]);
  return {col,row,key:`${col}:${row}`,x:col+world.grid.origin[0]+.5,y:row+world.grid.origin[1]+.5};
}
export function cellFromKey(world,key) {
  const [col,row]=key.split(':').map(Number);
  return {col,row,key,x:col+world.grid.origin[0]+.5,y:row+world.grid.origin[1]+.5};
}
export function terrainType(world,x,y) {
  const c=cellAt(world,x,y);
  return c.col<0||c.row<0||c.col>=world.grid.columns||c.row>=world.grid.rows?0:world.grid.mask[c.row*world.grid.columns+c.col];
}
export function heightAt(world,x,y) {
  const gx=Math.max(0,Math.min(world.grid.columns-.00001,x-world.grid.origin[0]));
  const gy=Math.max(0,Math.min(world.grid.rows-.00001,y-world.grid.origin[1]));
  const col=Math.floor(gx),row=Math.floor(gy),u=gx-col,v=gy-row,stride=world.grid.columns+1,h=world.grid.heights,i=row*stride+col;
  return (h[i]*(1-u)+h[i+1]*u)*(1-v)+(h[i+stride]*(1-u)+h[i+stride+1]*u)*v;
}
export function inBlocker(b,x,y,margin=0) {
  if(x<b.bounds[0]-margin||x>b.bounds[2]+margin||y<b.bounds[1]-margin||y>b.bounds[3]+margin)return false;
  if(!b.polygon)return true;
  let inside=false;
  for(let i=0,j=b.polygon.length-1;i<b.polygon.length;j=i++){
    const [ax,ay]=b.polygon[j],[bx,by]=b.polygon[i];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    if(Math.hypot(x-ax-t*dx,y-ay-t*dy)<=margin)return true;
  }return inside;
}
export function initialState(world,wall=Date.now()) {
  return {constructionVersion:1,schema:1,world:world.id,revision:0,gridOrigin:[...world.grid.origin],player:{x:world.heroStart[0],y:world.heroStart[1]},
    inventory:Object.fromEntries(SEEDS.map(s=>[s.id,s.kind==='crop'?6:3])),removedTrees:[],removedStumps:[],applePicks:{},woodDrops:[],treeDamage:{},removedRocks:[],rockDamage:{},tools:{tier:0},pickedSeeds:[],cells:{},buildings:[],animals:[],activeCharacter:'adam',characters:{adam:{name:'Adam',energy:MAX_ENERGY}},recentActions:[],
    stats:{trees:0,rocks:0,toolUpgrades:0,gems:0,plowed:0,planted:0,harvested:0,collected:0,fishCaught:0,mealsEaten:0,foodPrepared:0,rests:0,sleeps:0,built:0},clock:{minutes:480,wall,paused:false}};
}
function validState(s,world) {
  return s?.schema===1 && s.world===world.id && Number.isFinite(s.player?.x) && Number.isFinite(s.player?.y)
    && s.inventory && Object.values(s.inventory).every(v=>Number.isInteger(v)&&v>=0)
    && (s.constructionVersion===undefined||[0,1].includes(s.constructionVersion)) && (s.buildings||[]).every(b=>!b.project||b.project.crew.every(id=>s.characters?.[id])) && (s.reports===undefined||Array.isArray(s.reports)&&s.reports.length<=10) && validTreeDamage(s.treeDamage) && validCommunity(s.community) && validBuildings(s.buildings,world)
    && Array.isArray(s.removedTrees)&&validWoodDrops(s.woodDrops,s,world)&&Array.isArray(s.pickedSeeds)&&s.cells&&s.stats&&validAnimals(s.animals)
    && (s.removedRocks===undefined||Array.isArray(s.removedRocks))
    && (s.rockDamage===undefined||(s.rockDamage&&typeof s.rockDamage==='object'&&!Array.isArray(s.rockDamage)&&Object.values(s.rockDamage).every(v=>Number.isFinite(v)&&v>=0)))
    && (s.tools===undefined||(Number.isInteger(s.tools?.tier)&&s.tools.tier>=0&&s.tools.tier<TOOL_TIERS.length&&(s.tools.shovel===undefined||(Number.isInteger(s.tools.shovel)&&s.tools.shovel>=0&&s.tools.shovel<SHOVEL_TIERS.length))))
    && (s.characters===undefined||(s.characters&&typeof s.characters==='object'&&!Array.isArray(s.characters)&&Object.keys(s.characters).length>0&&Object.values(s.characters).every(c=>Number.isFinite(c?.energy)&&c.energy>=0&&c.energy<=MAX_ENERGY&&(c.hunger===undefined||Number.isFinite(c.hunger)&&c.hunger>=0&&c.hunger<=MAX_HUNGER&&Number.isFinite(c.hungerAt)))))
    && (s.characters===undefined||Object.values(s.characters).every(c=>(c.sleep===undefined||typeof c.sleep?.id==='string'&&typeof c.sleep.homeId==='string'&&Number.isFinite(c.sleep.startedAt))))
    && (s.activeCharacter===undefined||typeof s.activeCharacter==='string'&&!!s.characters?.[s.activeCharacter])
    && (s.recentActions===undefined||Array.isArray(s.recentActions))
    && (s.nightCursorWall===undefined||Number.isFinite(s.nightCursorWall)) && validNight(s.night) && (s.clock?.cycle===undefined||s.clock.cycle===1) && Number.isFinite(s.clock?.minutes)&&Number.isFinite(s.clock?.wall)&&typeof s.clock.paused==='boolean';
}
/** Cell keys are grid-relative; when a map export moves the grid origin, shift saved keys so everything stays put in the world. */
function shiftKey(key,dc,dr){const [c,r]=key.split(':').map(Number);return Number.isFinite(c)&&Number.isFinite(r)?`${c+dc}:${r+dr}`:key;}
export function migrateGrid(s,world){
 if(!s||typeof s!=='object')return s;
 const from=Array.isArray(s.gridOrigin)?s.gridOrigin:[-40,-40],to=world.grid.origin,dc=from[0]-to[0],dr=from[1]-to[1];
 if(!dc&&!dr)return s.gridOrigin?s:{...s,gridOrigin:[...to]};
 const next={...s,gridOrigin:[...to]};
 if(next.cells&&typeof next.cells==='object')next.cells=Object.fromEntries(Object.entries(next.cells).map(([k,v])=>[shiftKey(k,dc,dr),v]));
 if(Array.isArray(next.buildings))next.buildings=next.buildings.map(b=>b&&typeof b.key==='string'?{...b,key:shiftKey(b.key,dc,dr)}:b);
 if(next.community?.members)next.community={...next.community,members:Object.fromEntries(Object.entries(next.community.members).map(([id,m])=>[id,m?.job?.key?{...m,job:{...m.job,key:shiftKey(m.job.key,dc,dr)}}:m]))};
 return next;
}
export function migrateState(state){
 const hadSleepMeter=Object.values(state.characters||{}).some(c=>c.fatigue!==undefined||c.awakeSince!==undefined);
 // Built-in villagers are restored here for the standalone island; Players World prunes them again after load.
 const builtIns=state.community?{adam:{name:'Adam',energy:MAX_ENERGY},eve:{name:'Eve',energy:MAX_ENERGY},noah:{name:'Noah',energy:MAX_ENERGY}}:{adam:{name:'Adam',energy:MAX_ENERGY}};
 const characters=Object.fromEntries(Object.entries({...builtIns,...state.characters}).map(([id,c])=>{const {fatigue,awakeSince,...character}=c;return [id,Number.isFinite(character.hunger)?character:{...character,hunger:MAX_HUNGER,hungerAt:state.clock?.minutes??0}];}));
 const next={constructionVersion:1,...state,buildings:state.buildings||[],animals:state.animals||[],woodDrops:state.woodDrops||[],removedStumps:state.removedStumps||[],applePicks:state.applePicks||{},treeDamage:state.treeDamage||{},removedRocks:state.removedRocks||[],rockDamage:state.rockDamage||{},tools:normalizeTools(state.tools),activeCharacter:state.activeCharacter||'adam',characters,recentActions:state.recentActions||[],stats:{rocks:0,toolUpgrades:0,gems:0,fishCaught:0,mealsEaten:0,foodPrepared:0,rests:0,sleeps:0,built:0,...state.stats}};
 // Release an old fatigue-only helper nap without granting a refill or reward.
  if(hadSleepMeter&&next.community){next.community=structuredClone(next.community);for(const [id,m]of Object.entries(next.community.members)){if(m.job?.kind==='rest'&&(characters[id]?.energy??0)>LOW_ENERGY){m.position=memberPosition(m,state.clock.minutes);m.job=null;m.readyAt=state.clock.minutes;m.status='Ready to help';}}}
 return collapsePrayerTents(next);
}
function repairState(s, world) {
  if (!s || typeof s !== 'object') return s;
  const next = { ...s };
  if (Array.isArray(next.buildings)) next.buildings = next.buildings.filter((b) => validBuildings([b], world));
  if (Array.isArray(next.woodDrops)) next.woodDrops = next.woodDrops.filter((d) => validWoodDrops([d], next, world));
  if (next.animals !== undefined && !validAnimals(next.animals)) next.animals = Array.isArray(next.animals) ? next.animals.filter((a) => validAnimals([a])) : [];
  return next;
}
/**
 * The island's fenced garden starts full: one ripe column each of wheat, carrot, pumpkin and
 * sunflower in the 16 garden slots (the demo plots in the scenery mark the same cells). Runs once
 * per save; cells a player already dug or planted are left alone.
 */
const STARTER_GARDEN_COLUMNS=['wheat_seed','carrot_seed','pumpkin_seed','sunflower_seed'];
export function seedStarterGarden(state,world){
  if(state.starterGarden||!world.gardenSlots?.length)return state;
  const minutes=gameTime(state),cols=[...new Set(world.gardenSlots.map(s=>s.col))].sort((a,b)=>a-b),cells={...state.cells};
  for(const slot of world.gardenSlots){
    if(cells[slot.key]?.soil||cells[slot.key]?.seed)continue;
    const seed=seedById(STARTER_GARDEN_COLUMNS[cols.indexOf(slot.col)%STARTER_GARDEN_COLUMNS.length]);if(!seed)continue;
    cells[slot.key]={soil:'tilled',seed:seed.id,plantedAt:minutes-seed.hours*60,wateredAt:minutes,watered:true,grown:seed.hours*60};
  }
  return {...state,cells,starterGarden:1};
}
/** An empty garden plot grows weeds after one island day (1 day = 10 real minutes) with nothing planted. */
export const WEED_MINUTES=1440;
export function plotWeedy(cell,minutes){
  if(!cell?.soil||cell.seed||!Number.isFinite(cell.emptySince)||!Number.isFinite(minutes))return false;
  return minutes-cell.emptySince>=WEED_MINUTES;
}
/**
 * Empty plots that already exist when weeds arrive start their clock now.
 * That keeps a brand-new garden, and starter crops, from filling with weeds on the first load.
 */
export function noteEmptyPlots(state){
  if(state?.weedClock)return state;
  const minutes=gameTime(state),cells={...state.cells};
  for(const [key,c] of Object.entries(cells)){
    if(!c?.soil||c.seed||Number.isFinite(c.emptySince))continue;
    cells[key]={...c,emptySince:minutes};
  }
  return {...state,cells,weedClock:1};
}
/** The standalone island's built-in villagers. Players World has none: story friends do everything. */
export const BUILT_IN_IDS=['adam','eve','noah'];
/** Drop the hidden built-in villagers from a Players World save (keeping whoever is still being played, or on a build crew). */
export function pruneBuiltIns(state){
 const characters=state.characters||{},crewed=new Set((state.buildings||[]).flatMap(b=>b.project?.crew||[]));
 const drop=BUILT_IN_IDS.filter(id=>id in characters&&id!==state.activeCharacter&&!crewed.has(id));
 if(!drop.length)return state;
 const kept={...characters};for(const id of drop)delete kept[id];
 const night=state.night?.homes?{...state.night,homes:Object.fromEntries(Object.entries(state.night.homes).filter(([id])=>!drop.includes(id)))}:state.night;
 return {...state,characters:kept,night};
}
export class GameStore {
  constructor(world,storage,wall=Date.now(),{playersOnly=false}={}) {
    this.world=world;this.storage=storage;this.error='';this.savedAt=null;this.playersOnly=playersOnly;
    // First profile after the per-profile change inherits the legacy save (copy); other profiles start fresh.
    migrateLegacyKeys([SAVE_KEY_BASE,`${SAVE_KEY_BASE}_backup`],storage);
    // A stale (pre-profile) island bundle may still have written the legacy save after the copy: a higher revision there wins once.
    adoptNewerLegacy(SAVE_KEY_BASE,(legacy,current)=>{try{return (JSON.parse(legacy).revision||0)>(JSON.parse(current).revision||0);}catch{return false;}},storage);
    const raw=storage.getItem(SAVE_KEY);
    if(raw){try {let s=migrateGrid(JSON.parse(raw),world);if(!validState(s,world)){const repaired=repairState(s,world);if(!validState(repaired,world))throw Error('unrecognized save');s=repaired;}this.state=noteEmptyPlots(seedStarterGarden(this.migrate(s),world));for(const [missing,suffix] of [[Object.values(s.characters||{}).some(c=>c.fatigue!==undefined||c.awakeSince!==undefined),'before_remove_sleep_meter'],[s.community&&!s.community.members.adam,'before_character_control'],[projectBuildings(s).some(b=>b.project.basis!==CONSTRUCTION_BASIS),'before_island_build_days'],[s.constructionVersion===undefined,'before_construction_crews'],[s.treeDamage===undefined,'before_resource_health'],[s.community===undefined,'before_community'],[s.woodDrops===undefined,'before_wood_storage'],[s.removedRocks===undefined,'before_mining'],[s.characters===undefined,'before_energy'],[s.buildings===undefined,'before_building']])if(missing&&!storage.getItem(`${SAVE_KEY}_${suffix}`)){try{storage.setItem(`${SAVE_KEY}_${suffix}`,raw);}catch{/* Main writes still report storage failures without discarding this state. */}}}catch{this.state=initialState(world,wall);this.error='The previous test save could not be read. It has been kept. Reset this test to start a new save.';this.locked=true;}}
    else this.state=noteEmptyPlots(seedStarterGarden(initialState(world,wall),world));
  }
  /** migrateState restores the built-in villagers on every read; Players World drops them again right here, so they never live in its save. */
  migrate(s){const next=migrateState(s);return this.playersOnly?pruneBuiltIns(next):next;}
  save(next,wall=Date.now()) {
    if(this.locked)throw Error(this.error);
    const latest=this.readLatest();if(latest&&latest.revision>this.state.revision){this.state=latest;throw Error('Progress changed in another HomeWorld window. Please try that action again.');}
    if(this.playersOnly)next=rememberCompletedBuildings(this.state,next,wall);
    const minutes=gameTime(next,wall);
    const anchored={...next,clock:{...next.clock,minutes,wall},revision:Math.max(next.revision,this.state.revision)+1};
    // Only expose inventory/world changes once the whole save has succeeded.
    try{this.storage.setItem(SAVE_KEY,JSON.stringify(anchored));}catch{this.error='Saving is unavailable. Your last saved progress is safe. Try allowing storage in this browser.';throw Error(this.error);}
    this.state=anchored;this.savedAt=wall;this.error='';return anchored;
  }
  commit(action,wall=Date.now()) {
    const latest=this.readLatest();if(latest&&latest.revision>this.state.revision)this.state=latest;
    let next=applyAction(this.state,action,this.world,gameTime(this.state,wall),wall);
    if(this.playersOnly)next=rememberResidentAction(this.state,next,action,{actorId:this.state.activeCharacter,wall});
    return next===this.state?this.state:this.save(next,wall);
  }
  communityStep(options={},wall=Date.now()) {
    const latest=this.readLatest();if(latest&&latest.revision>this.state.revision)this.state=latest;
    const before=this.state;let working=before;
    const sleeper=before.characters?.[before.activeCharacter]?.sleep;
    if(options.offline&&sleeper&&wall-sleeper.startedAt>=SLEEP_SECONDS*1000){
      working=applyAction(before,{type:'finish_sleep',sleepId:sleeper.id,actionId:`wake:${sleeper.id}`},this.world,gameTime(before,wall),wall);
      if(working!==before){for(const b of projectBuildings(working)){const w=b.project.workers[before.activeCharacter];if(w){w.position={...working.player};w.credited=0;w.phase='waiting';w.start=Math.max(b.project.cursor,sleeper.startedAt+SLEEP_SECONDS*1000);w.end=w.start;w.path=null;delete w.homeId;}}}
    }
    const advanceWork=(state,to,opts)=>{const projects=convertProjectTiming(advanceProjects(state,this.world,to,projectAPI,{activePlayer:!!opts.active,offline:!!opts.offline}));const reservedMembers=[...new Set([...(opts.reservedMembers||[]),...projectBuildings(state).filter(b=>!b.project.paused).flatMap(b=>b.project.crew)])];return advanceCommunity(projects,this.world,gameTime(projects,to),to,{Navigation,growth,cellFromKey,applyAction},{...opts,reservedMembers});};
    let next=advanceNightCycle(working,this.world,wall,advanceWork,options);
    if(options.offline)next=returnedReport(before,next,wall);
    if(options.offline)delete next.away;if(!options.background)next.lastOnlineWall=wall;return this.save(next,wall);
  }
  enableNightCycle(wall=Date.now()){
    if(this.state.clock.cycle===1)return this.state;
    const raw=this.storage.getItem(SAVE_KEY);if(raw&&!this.storage.getItem(`${SAVE_KEY}_before_shared_nights`))this.storage.setItem(`${SAVE_KEY}_before_shared_nights`,raw);
    return this.save({...this.state,clock:{...this.state.clock,minutes:gameTime(this.state,wall),wall,cycle:1},nightCursorWall:wall},wall);
  }
  noteAway(wall=Date.now()){if(this.state.away)return this.state;return this.save({...this.state,away:reportBaseline(this.state,wall)},wall);}
  communitySettings(changes,wall=Date.now()) {
    const latest=this.readLatest();if(latest&&latest.revision>this.state.revision)this.state=latest;
    return this.save(configureCommunity(this.state,gameTime(this.state,wall),changes),wall);
  }
  readLatest(){try{const raw=this.storage.getItem(SAVE_KEY);if(!raw)return null;const s=migrateGrid(JSON.parse(raw),this.world);return validState(s,this.world)?this.migrate(s):null;}catch{return null;}}
  /** Conversation memory changes only when a resident is tapped, alongside normal island saves. */
  residentLine(resident,context,wall=Date.now()) {
    if(!this.playersOnly)return null;
    const latest=this.readLatest();if(latest&&latest.revision>this.state.revision)this.state=latest;
    const result=nextResidentLine(this.state,resident,context,wall);
    if(result.state!==this.state)this.save(result.state,wall);
    return result.line;
  }
  persistPlayer(player,wall=Date.now()) {return this.save({...this.state,player:{x:player.x,y:player.y}},wall);}
  /** Apply an action as another character standing at `position` (island helpers doing chores). */
  commitAs(id,name,position,action,wall=Date.now()) {
    const latest=this.readLatest();if(latest&&latest.revision>this.state.revision)this.state=latest;
    const base=this.state,characters=base.characters?.[id]?base.characters:{...base.characters,[id]:{name:name||id,energy:100}};
    const scoped={...base,characters,activeCharacter:id,player:{x:position.x,y:position.y}};
    let next=applyAction(scoped,action,this.world,gameTime(scoped,wall),wall);
    if(next===scoped)return base;
    if(this.playersOnly)next=rememberResidentAction(scoped,next,action,{actorId:id,helper:true,wall});
    return this.save({...next,player:base.player,activeCharacter:base.activeCharacter},wall);
  }
  clockChange(delta=0,paused=this.state.clock.paused,wall=Date.now()) {
    const from=gameTime(this.state,wall),to=from+delta;
    let next={...this.state,clock:{...this.state.clock,minutes:to,wall,paused}};
    if(next.clock.cycle===1){next.nightCursorWall=wall;if(delta)delete next.night;next=applyFarmSpan(next,this.world,from,to);}
    return this.save(next,wall);
  }
  reset(wall=Date.now()) {
    const raw=this.storage.getItem(SAVE_KEY);if(raw)this.storage.setItem(`${SAVE_KEY}_backup`,raw);
    this.locked=false;return this.save(initialState(this.world,wall),wall);
  }
  undoReset(wall=Date.now()) {
    const raw=this.storage.getItem(`${SAVE_KEY}_backup`);if(!raw)throw Error('There is no previous test to restore.');
    const s=JSON.parse(raw);if(!validState(s,this.world))throw Error('That previous save cannot be restored.');
    this.locked=false;return this.save(this.migrate(s),wall);
  }
}
export function plantedTrees(world,state,minutes) {
  return Object.entries(state.cells).flatMap(([key,c])=>{
    const g=growth(c,minutes);if(g?.seed.kind!=='tree'||g.stage!=='ready')return [];
    const p=cellFromKey(world,key);return [{id:`planted:${key}:${c.plantedAt}`,species:g.seed.plant,position:[p.x,p.y,heightAt(world,p.x,p.y)],scale:[1,1,1],yaw:0,radius:.35,cell:key}];
  });
}
export function activeTrees(world,state,minutes) {return [...world.trees,...plantedTrees(world,state,minutes)].filter(t=>!state.removedTrees.includes(t.id));}
export function activeRocks(world,state){return world.boulders.filter(r=>!(state.removedRocks||[]).includes(r.id));}
/** Stumps left where island trees were felled. They stay until dug out with the Dig tool (or the spot is turned into a garden). */
export function activeStumps(world,state){return world.trees.filter(t=>state.removedTrees.includes(t.id)&&!(state.removedStumps||[]).includes(t.id)&&!state.cells[cellAt(world,t.position[0],t.position[1]).key]?.soil);}
export const stumpRadius=t=>Math.min(t.radius||.3,.5)+.2;
/** Apple trees carry fruit again half an island day after a picking. */
export const APPLE_REGROW_MINUTES=720,APPLES_PER_PICK=3;
export const isAppleTree=(world,id)=>world.trees.find(t=>t.id===id)?.species==='apple';
export const applesReady=(state,id,minutes)=>!((state.applePicks||{})[id]>minutes-APPLE_REGROW_MINUTES);
export const appleTreesReady=(world,state,minutes)=>world.trees.filter(t=>t.species==='apple'&&!state.removedTrees.includes(t.id)&&applesReady(state,t.id,minutes));
export function canPlow(world,state,key) {
  const p=cellFromKey(world,key);if(terrainType(world,p.x,p.y)!==2)return false;
  if(state.cells[key]?.seed)return false;
  if(activeBuildings(state).some(b=>(b.kind!=='garden'||b.status!=='complete')&&pointInBounds(p,footprint(world,b).bounds,.02)))return false;
  if(world.blockers.some(b=>inBlocker(b,p.x,p.y,.15)))return false;
  if(activeRocks(world,state).some(b=>dist(p,{x:b.position[0],y:b.position[1]})<b.radius+.45))return false;
  return !activeTrees(world,state,gameTime(state)).some(t=>dist(p,{x:t.position[0],y:t.position[1]})<t.radius+.6);
}
export function applyAction(state,a,world,minutes,wall=Date.now()) {
  if(a.actionId&&state.recentActions?.includes(a.actionId))return state;
  if(state.clock.cycle===1&&(state.night||dayPhase({...state.clock,minutes,wall,paused:true},wall).night)&&!['read_report','pause_project','cancel_building','cancel_sleep','finish_forge','remove_building','sell'].includes(a.type))return state;
  if(a.type==='select_character'){if(a.previousId!==state.activeCharacter||typeof a.actionId!=='string'||!a.actionId)return state;const next=selectCharacter(state,a.id,a.position,minutes,wall);if(next!==state){next.recentActions=[...(next.recentActions||[]),a.actionId].slice(-256);}return next;}
  if(['eat','serve_meal','fish','cook','craft_recipe','rest','pray','begin_sleep','finish_sleep','cancel_sleep','place_building','stack_piece','upgrade_building','begin_building','finish_building','cancel_building','move_building','pause_project','read_report','place_animal','remove_animal','remove_building','sell'].includes(a.type)&&!(typeof a.actionId==='string'&&a.actionId.length>0&&a.actionId.length<=128))return state;
  if(['plow','plant','water','harvest'].includes(a.type)){const claim=communityClaim(state,a.key);if(claim&&claim.id!==a.actionId)return state;}
  const character=activeCharacter(state),asleep=state.characters?.[character]?.sleep;
  if(asleep&&!['finish_sleep','cancel_sleep','finish_building','read_report','pause_project','finish_forge','sell'].includes(a.type))return state;
  const cost=energyCost(state,a);if(energyFor(state)<cost)return state;
  const next=structuredClone(state);const inv=next.inventory;const add=(id,n)=>inv[id]=(inv[id]||0)+n;
  delete next.characters[character].fatigue;delete next.characters[character].awakeSince;
  // The tummy clock starts the first time a character does anything on the island.
  if(!Number.isFinite(next.characters[character].hunger))setHunger(next,MAX_HUNGER,minutes);
  if(a.type==='begin_sleep') {
    const home=sleepHome(state,a.homeId);if(!home||homeReserved(state,home.id)||!canSleep(state,minutes)||dist(state.player,workPoint(world,home))>1.5)return state;
    next.characters[character].sleep={id:a.actionId,homeId:home.id,startedAt:wall};
  } else if(a.type==='finish_sleep') {
    const home=sleepHome(state,asleep?.homeId);if(!asleep||asleep.id!==a.sleepId||!home||wall-asleep.startedAt<SLEEP_SECONDS*1000||dist(state.player,workPoint(world,home))>1.5)return state;
    const wakeMinutes=minutes+(state.clock.cycle===1?0:SLEEP_HOURS*60);
    setEnergy(next,MAX_ENERGY);delete next.characters[character].sleep;
    next.stats.sleeps=(next.stats.sleeps||0)+1;next.clock={...next.clock,minutes:wakeMinutes,wall};
  } else if(a.type==='cancel_sleep') {
    if(!asleep||asleep.id!==a.sleepId)return state;delete next.characters[character].sleep;
  } else if(a.type==='read_report'){
    const report=next.reports?.find(r=>r.id===a.id);if(!report||report.read)return state;report.read=true;
  } else if(a.type==='pause_project'){
    const b=next.buildings.find(b=>b.id===a.id);if(!b?.project||b.status==='complete'||typeof a.paused!=='boolean')return state;
    if(!a.paused&&!crewStatus(next,b.kind,b.project.crew).ok)return state;
    b.project.paused=a.paused;b.project.cursor=wall;for(const [id,w]of Object.entries(b.project.workers)){w.position=projectWorkerPosition(w,wall);w.phase='waiting';w.start=wall;w.end=wall;w.credited=0;w.path=null;delete w.homeId;}
  } else if(a.type==='move_building') {
    const b=next.buildings?.find(b=>b.id===a.id);if(!b||b.status!=='complete'||activeBuildings(state).some(b=>b.status!=='complete'&&!b.project))return state;
    const status=buildMoveStatus(world,state,a,minutes);if(!status.ok)return state;
    const old=footprint(world,b),moved={...b,key:a.key,rotation:a.rotation},fresh=footprint(world,moved);
    if(b.kind==='garden'){
      const cells=old.keys.map(key=>next.cells[key]);for(const key of old.keys)delete next.cells[key];
      for(let i=0;i<fresh.keys.length;i++)if(cells[i])next.cells[fresh.keys[i]]={...cells[i],buildingId:b.id};
    }
    b.key=a.key;b.rotation=a.rotation;b.baseHeight=status.baseHeight;
  } else if(a.type==='place_building') {
    const def=buildingById(a.kind),stroke=!!(def?.stroke&&a.stroke);
    // A fence stroke is finished the moment it is placed, so the garden fence can go up while a house is still being raised.
    const busy=activeBuildings(state).some(b=>b.status!=='complete'&&!b.project);
    if((busy&&!(stroke&&def?.instant))||(state.buildings||[]).some(b=>b.id===a.id)||typeof a.id!=='string'||!a.id||a.id.length>128)return state;
    if(def?.once&&activeBuildings(state).some(b=>b.kind===a.kind))return state;
    const status=stroke?strokePlacementStatus(world,state,a,minutes,a.people||[]):buildPlacementStatus(world,state,a,minutes);if(!status.ok)return state;
    const paidMaterials=spendMaterials(next,a.kind),instant=!!def?.instant;
    next.buildings??=[];
    const placed={id:a.id,kind:a.kind,key:a.key,rotation:a.rotation,status:instant?'complete':'queued',baseHeight:status.baseHeight,paidMaterials,startedAt:instant?wall:null};
    if(stroke&&def.stack)placed.layers=1;
    next.buildings.push(placed);
    if(stroke&&instant)orientStrokeNeighbors(next.buildings,placed.key,placed.kind);
    if(!instant&&state.constructionVersion===1&&projectPlan(a.kind)){const b=next.buildings.at(-1),prepared=prepareProject(next,world,b,wall,projectAPI,a.crew||defaultCrew(state,a.kind));if(prepared.error)return state;b.project=prepared.project;b.project.target=footprint(world,b).center;}
  } else if(a.type==='stack_piece') {
    const b=next.buildings?.find(b=>b.id===a.id),def=b&&buildingById(b.kind);
    if(!b||b.status!=='complete'||!def?.stack||layerCount(b)>=def.stack)return state;
    if(activeBuildings(state).some(x=>x.status!=='complete'&&!x.project))return state;
    if(strokeNeed(state,b.kind)||energyFor(state)<BUILD_ENERGY)return state;
    const fp=footprint(world,b),people=strokeStanders(state,a.people);
    if(!fp||pointInBounds(state.player,fp.bounds,.4)||people.some(p=>pointInBounds(p,fp.bounds,.4)))return state;
    addPaid(b.paidMaterials,spendMaterials(next,b.kind));b.layers=layerCount(b)+1;
  } else if(a.type==='upgrade_building') {
    const status=buildUpgradeStatus(world,state,a.id,minutes,a.crew);if(!status.ok||status.plan.kind!==a.kind)return state;
    const old=state.buildings.find(b=>b.id===a.id),b=next.buildings.find(b=>b.id===a.id),paid=spendMaterials(next,a.kind,upgradeCost(old));
    b.upgradeFrom=structuredClone(old);b.kind=status.plan.kind;b.key=status.plan.key;b.rotation=status.plan.rotation;b.baseHeight=status.baseHeight;b.status='queued';b.startedAt=null;b.jobId=a.actionId;
    for(const [id,n]of Object.entries(paid))b.paidMaterials[id]=(b.paidMaterials[id]||0)+n;
    if(state.constructionVersion===1&&projectPlan(a.kind)){delete b.project;const prepared=prepareProject(next,world,b,wall,projectAPI,a.crew||defaultCrew(state,a.kind));if(prepared.error)return state;b.project=prepared.project;b.project.target=footprint(world,b).center;}
  } else if(a.type==='begin_building') {
    const b=next.buildings?.find(b=>b.id===a.id);if(!b||b.project||b.status!=='queued'||dist(state.player,workPoint(world,b))>1.05)return state;
    // The builder sets loose logs beside him before covering the site.
    const site=footprint(world,b);for(const drop of next.woodDrops||[])if(pointInBounds(drop,site.bounds,.2)){drop.x=state.player.x;drop.y=state.player.y;}
    b.status='building';b.startedAt=wall;
  } else if(a.type==='finish_building') {
    const b=next.buildings?.find(b=>b.id===a.id);if(!b||b.project||b.status!=='building'||buildingProgress(b,wall)<1)return state;
    b.status='complete';if(b.kind==='campfire')b.fuelUntil=minutes+FIRE_LOG_MINUTES;if(b.upgradeFrom){next.stats.houseUpgrades=(next.stats.houseUpgrades||0)+1;delete b.upgradeFrom;}else next.stats.built=(next.stats.built||0)+1;
    if(b.kind==='garden')for(const key of footprint(world,b).keys){if(next.cells[key])return state;next.cells[key]={soil:'tilled',emptySince:minutes,buildingId:b.id};}
  } else if(a.type==='cancel_building') {
    const b=next.buildings?.find(b=>b.id===a.id);if(!b||b.status!=='queued')return state;
    if(b.upgradeFrom){const old=b.upgradeFrom;for(const [id,n]of Object.entries(b.paidMaterials)){const refund=n-(old.paidMaterials[id]||0);if(refund)add(id,refund);}delete b.upgradeFrom;delete b.jobId;delete b.project;Object.assign(b,old);}
    else{for(const [id,n]of Object.entries(b.paidMaterials))add(id,n);b.status='cancelled';}
    setEnergy(next,energyFor(next)+BUILD_ENERGY);
  } else if(a.type==='remove_building') {
    const b=next.buildings?.find(x=>x.id===a.id),def=b&&buildingById(b.kind);
    if(!b||b.status!=='complete'||!def)return state;
    if(homeReserved(state,b.id)||Object.values(state.characters||{}).some(c=>c.sleep?.homeId===b.id))return state;
    const paid=b.paidMaterials&&Object.keys(b.paidMaterials).length?b.paidMaterials:null;
    if(paid){for(const [id,n] of Object.entries(paid))if(n>0)add(id,n);}
    else{
      const woodId=Object.values(world.species||{}).map(s=>s.wood_item).find(Boolean);
      if(woodId&&def.wood)add(woodId,def.wood);
      if(def.stone)add('stone',def.stone);
      if(def.clay)add('clay',def.clay);
      for(const [id,n] of Object.entries(def.bundle||{}))if(n)add(id,n);
    }
    if(b.kind==='garden'){const fp=footprint(world,b);if(fp)for(const key of fp.keys)delete next.cells[key];}
    for(const [key,cell] of Object.entries(next.cells||{}))if(cell?.buildingId===b.id)delete next.cells[key];
    b.status='cancelled';
    if(next.farm?.integrity)delete next.farm.integrity[b.id];
  } else if(a.type==='remove_fence') {
    // Take down one finished fence piece (or a lone path stone) and get the materials back: Abel moves
    // the ring outward when the garden grows. Needs him standing beside it.
    const b=next.buildings?.find(b=>b.id===a.id),def=b&&buildingById(b.kind);
    if(!b||b.status!=='complete'||!def||!(def.stroke||b.kind==='path')||!footprint(world,b)||dist(state.player,footprint(world,b).center)>2.2)return state;
    for(const [id,n]of Object.entries(b.paidMaterials||{}))add(id,n);b.status='cancelled';
    if(next.farm?.integrity)delete next.farm.integrity[b.id];
  } else if(a.type==='place_animal') {
    if(typeof a.id!=='string'||!a.id||a.id.length>128||(state.animals||[]).some(x=>x.id===a.id)||!animalPlacementStatus(world,state,a).ok)return state;
    next.animals??=[];next.animals.push({id:a.id,kind:a.kind,x:a.x,y:a.y,placedAt:wall});
  } else if(a.type==='remove_animal') {
    if(!(state.animals||[]).some(x=>x.id===a.id))return state;next.animals=next.animals.filter(x=>x.id!==a.id);
  } else if(a.type==='chop'||a.type==='chop_hit') {
    const tree=activeTrees(world,state,minutes).find(t=>t.id===a.id);if(!tree)return state;
    const room=woodRoom(state);if(!room)return state;
    const remaining=a.type==='chop_hit'?Math.max(0,treeRemaining(tree,state)-toolTier(state).power):0;
    next.treeDamage??={};
    if(remaining>0)next.treeDamage[tree.id]=TREE_MAX_HEALTH-remaining;
    else{
      delete next.treeDamage[tree.id];const quantity=Math.min(3,room);next.removedTrees.push(tree.id);const sp=world.species[tree.species];add(sp.wood_item,quantity);add(sp.seed_item,1);next.stats.trees++;
      if(quantity<3){next.woodDrops??=[];next.woodDrops.push({id:`wood:${tree.id}`,treeId:tree.id,item:sp.wood_item,quantity:3-quantity,x:tree.position[0],y:tree.position[1]});}
      if(tree.cell)next.cells[tree.cell]={soil:'tilled',emptySince:minutes,generation:(next.cells[tree.cell]?.generation||0)+1,...(next.cells[tree.cell]?.buildingId?{buildingId:next.cells[tree.cell].buildingId}:{})};
    }
  } else if(a.type==='pickup_wood') {
    const drop=next.woodDrops?.find(d=>d.id===a.id),room=woodRoom(state);if(!drop||!room||dist(state.player,drop)>.95)return state;
    const quantity=Math.min(room,drop.quantity);add(drop.item,quantity);drop.quantity-=quantity;next.woodDrops=next.woodDrops.filter(d=>d.quantity>0);
  } else if(a.type==='mine_hit') {
    const rock=activeRocks(world,state).find(r=>r.id===a.id);if(!rock)return state;
    const profile=rockProfile(rock),tier=toolTier(state);if(tier.tier<profile.minTier)return state;
    const damage=(state.rockDamage?.[rock.id]||0)+tier.power;
    next.rockDamage??={};next.removedRocks??=[];
    if(damage>=profile.maxHealth){next.removedRocks.push(rock.id);delete next.rockDamage[rock.id];for(const [id,n]of Object.entries(profile.drops))add(id,n);next.stats.rocks=(next.stats.rocks||0)+1;next.stats.gems=(next.stats.gems||0)+(profile.drops.diamond||0);}
    else next.rockDamage[rock.id]=damage;
  } else if(a.type==='eat') {
    const food=FOODS[a.item],farmFood=a.source==='farm';
    if(a.source&&a.source!=='farm'&&a.source!=='inventory')return state;
    const bag=farmFood&&character==='you'&&['egg','milk'].includes(a.item)?next.livingFarm?.bag:!farmFood?inv:null;
    if(!food||!bag||!(bag[a.item]>0))return state;
    const gain=mealGain(state,a.item,minutes);if(gain.total<=0)return state;
    bag[a.item]--;setEnergy(next,energyFor(state)+food.energy);setHunger(next,hungerFor(state,minutes)+foodFill(a.item),minutes);next.stats.mealsEaten=(next.stats.mealsEaten||0)+1;
  } else if(a.type==='serve_meal') {
    // A shared meal at the Dining Hall: every diner is fed from the bag at once (hungriest first,
    // best-fitting helpings), and whatever is not needed stays in the bag. See dining.mjs planMeal.
    if(!Array.isArray(a.diners)||!a.diners.length||a.diners.length>16||a.diners.some(d=>typeof d?.id!=='string'||!d.id))return state;
    const hall=activeBuildings(state).find(b=>b.id===a.hallId&&b.kind===HALL_KIND&&b.status==='complete');if(!hall)return state;
    for(const d of a.diners){if(!next.characters[d.id])next.characters[d.id]={name:d.name||d.id,energy:MAX_ENERGY};if(!Number.isFinite(next.characters[d.id].hunger))setHunger(next,MAX_HUNGER,minutes,d.id);}
    const meal=planMeal(next,a.diners,minutes);if(!meal.servings.length)return state;
    for(const s of meal.servings){inv[s.item]--;setEnergy(next,energyFor(next,s.id)+FOODS[s.item].energy,s.id);setHunger(next,hungerFor(next,minutes,s.id)+foodFill(s.item),minutes,s.id);}
    next.stats.mealsEaten=(next.stats.mealsEaten||0)+meal.servings.length;next.stats.sharedMeals=(next.stats.sharedMeals||0)+1;
    next.lastMeal={at:minutes,hallId:hall.id,served:meal.served,servings:meal.servings,diners:a.diners.map(d=>d.id),hungry:meal.stillHungry,cook:typeof a.cook==='string'?a.cook:null};
  } else if(a.type==='cook') {
    if(!canCook(state,a.recipe))return state;
    const recipe=RECIPES[a.recipe],stations=recipe.station==='oven'?hotOvens(state,minutes):recipe.station==='well'?completedWells(state):litFires(state,minutes),station=stations.find(b=>b.id===a.fireId);
    if(!station||dist(state.player,workPoint(world,station))>1.45)return state;
    for(const [id,n]of Object.entries(recipe.ingredients))inv[id]-=n;add(recipe.item,recipe.quantity);
    if(FOODS[recipe.item])next.stats.foodPrepared=(next.stats.foodPrepared||0)+recipe.quantity;else next.stats.crafted=(next.stats.crafted||0)+recipe.quantity;
  } else if(a.type==='craft_recipe') {
    // A cook combines two bag items into one snack. No station: it happens between meals.
    const dish=recipeById(a.recipe);if(!dish)return state;
    const made=combineRecipe(state.inventory,dish.id);if(sameStocks(made,state.inventory))return state;
    for(const id of Object.keys(inv))if(!(id in made))delete inv[id];
    for(const [id,n] of Object.entries(made))inv[id]=n;
    next.stats.foodPrepared=(next.stats.foodPrepared||0)+1;
    const day=recipeDay(minutes),prev=state.recipeNotices?.day===day?state.recipeNotices.ids||[]:[];
    if(!prev.includes(dish.id))next.recipeNotices={day,ids:[...prev,dish.id]};
  } else if(a.type==='stoke') {
    const fire=heatSources(state).find(b=>b.id===a.fireId);if(!fire||dist(state.player,workPoint(world,fire))>1.45||!fireCanTakeLog(fire,minutes))return state;
    const log=Object.entries(inv).filter(([id,n])=>id.endsWith('_wood')&&n>0).sort((x,y)=>y[1]-x[1])[0];if(!log)return state;
    inv[log[0]]--;const f=next.buildings.find(b=>b.id===fire.id);if(f.kind==='oven'&&fireFuelLeft(fire,minutes)<=0)f.litAt=minutes;f.fuelUntil=Math.max(minutes,f.fuelUntil||0)+logMinutesFor(f);next.stats.logsAdded=(next.stats.logsAdded||0)+1;
  } else if(a.type==='fish') {
    const spot=world.fishingSpots?.find(s=>s.id===a.spotId);
    if(!spot||dist(state.player,{x:spot.position[0],y:spot.position[1]})>1.25||!terrainType(world,spot.position[0],spot.position[1])||terrainType(world,spot.water[0],spot.water[1])!==0)return state;
    add('fish',1);next.stats.fishCaught=(next.stats.fishCaught||0)+1;
  } else if(a.type==='sell') {
    // The built market buys surplus from the bag. Coins are credited by the parent app, not stored here.
    const stall=activeBuildings(state).find(b=>b.id===a.stallId&&b.kind==='market'&&b.status==='complete');
    if(!stall)return state;
    const sold=takeForSale(inv,a.item,a.qty);if(!sold)return state;
    for(const id of Object.keys(inv))delete inv[id];
    Object.assign(inv,sold.inventory);
    next.stats.sold=(next.stats.sold||0)+sold.qty;
    next.lastSale={item:sold.id,qty:sold.qty,coins:sold.coins,at:minutes};
  } else if(a.type==='rest') {
    const gain=restGain(state);if(!gain)return state;setEnergy(next,energyFor(state)+gain);next.stats.rests=(next.stats.rests||0)+1;
  } else if(a.type==='pray') {
    const gain=prayGain(state,minutes);if(!gain)return state;setEnergy(next,energyFor(state)+gain);next.lastPrayer=minutes;next.stats.prayers=(next.stats.prayers||0)+1;
  } else if(a.type==='upgrade_tools') {
    const status=upgradeStatus(state,a.tier);if(!status.canCraft)return state;
    const recipe=TOOL_TIERS[a.tier]?.recipe||{};
    for(const [id,n]of Object.entries(recipe)){if((inv[id]||0)<n)return state;inv[id]-=n;}
    // Stone is the instant starter. Metal tiers spend materials now and finish when the forge timer ends.
    if((a.tier||0)<=0){next.tools={...next.tools,tier:a.tier};next.stats.toolUpgrades=(next.stats.toolUpgrades||0)+1;}
    else{if(!hasForge(state)||forgeJob(state))return state;next.tools={...next.tools,forge:{tier:a.tier,startedAt:minutes}};}
  } else if(a.type==='finish_forge') {
    const job=forgeJob(state);if(!job||!forgeProgress(state,minutes)?.done)return state;
    if(job.kind==='shovel'){
      const owned=state.tools?.shovel||0;if(job.tier!==owned+1)return state;
      next.tools={...next.tools,shovel:job.tier};delete next.tools.forge;next.stats.toolUpgrades=(next.stats.toolUpgrades||0)+1;
    }else{
      if(job.tier!==toolTier(state).tier+1)return state;
      next.tools={...next.tools,tier:job.tier};delete next.tools.forge;next.stats.toolUpgrades=(next.stats.toolUpgrades||0)+1;
    }
  } else if(a.type==='upgrade_shovel') {
    const status=shovelStatus(state,a.tier);if(!status.canCraft)return state;
    if((a.tier||0)<=1){spendShovelRecipe(next,a.tier);next.tools={...next.tools,shovel:a.tier};next.stats.toolUpgrades=(next.stats.toolUpgrades||0)+1;}
    else{if(!hasForge(state)||forgeJob(state))return state;spendShovelRecipe(next,a.tier);next.tools={...next.tools,forge:{kind:'shovel',tier:a.tier,startedAt:minutes}};}
  } else if(a.type==='pickup') {
    const seed=world.seeds.find(s=>s.id===a.id);if(!seed||state.pickedSeeds.includes(seed.id))return state;
    next.pickedSeeds.push(seed.id);add(seed.itemId,seed.quantity);next.stats.collected+=seed.quantity;
  } else if(a.type==='plow') {
    if(!canPlow(world,state,a.key)||state.cells[a.key]?.soil==='tilled')return state;
    next.cells[a.key]={soil:'tilled',emptySince:minutes,...(state.cells[a.key]?.buildingId?{buildingId:state.cells[a.key].buildingId}:{})};next.stats.plowed++;
  } else if(a.type==='clear_weeds') {
    const c=state.cells[a.key];if(!c?.soil||c.seed||!plotWeedy(c,minutes))return state;
    next.cells[a.key]={soil:'tilled',emptySince:minutes,...(c.buildingId?{buildingId:c.buildingId}:{}),...(c.generation?{generation:c.generation}:{})};next.stats.weedsCleared=(next.stats.weedsCleared||0)+1;
  } else if(a.type==='plant') {
    const c=next.cells[a.key];if(!c||c.seed||!['tilled','harvested'].includes(c.soil)||plotWeedy(c,minutes)||!seedById(a.seed)||!(inv[a.seed]>0))return state;
    c.seed=a.seed;c.plantedAt=minutes;c.watered=false;delete c.wateredAt;delete c.emptySince;c.grown=0;inv[a.seed]--;next.stats.planted++;
  } else if(a.type==='water') {
    const c=next.cells[a.key],g=growth(c,minutes);if(!g||!g.thirsty)return state;c.grown=g.age;c.wateredAt=minutes;c.watered=true;next.stats.watered=(next.stats.watered||0)+1;
  } else if(a.type==='harvest') {
    const c=next.cells[a.key],g=growth(c,minutes);if(!g||g.stage!=='ready'||g.seed.kind!=='crop')return state;
    add(g.seed.plant,3);add(g.seed.id,1);next.cells[a.key]={soil:'harvested',emptySince:minutes,...(c.buildingId?{buildingId:c.buildingId}:{})};next.stats.harvested++;
  } else if(a.type==='pick_apples') {
    const tree=world.trees.find(t=>t.id===a.id);if(!tree||tree.species!=='apple'||state.removedTrees.includes(a.id)||!applesReady(state,a.id,minutes)||dist(state.player,{x:tree.position[0],y:tree.position[1]})>2.2)return state;
    add('apple',APPLES_PER_PICK);next.applePicks={...(state.applePicks||{}),[a.id]:minutes};next.stats.applesPicked=(next.stats.applesPicked||0)+APPLES_PER_PICK;
  } else if(a.type==='dig_mud') {
    if(!/^\d{1,3}:\d{1,3}$/.test(a.key||''))return state;const p=cellFromKey(world,a.key);if(terrainType(world,p.x,p.y)!==1||dist(state.player,p)>1.6)return state;
    add('mud',1);next.stats.mudDug=(next.stats.mudDug||0)+1;
  } else if(a.type==='fetch_water') {
    const well=completedWells(state).find(b=>b.id===a.wellId);if(!well||dist(state.player,workPoint(world,well))>1.45||(inv.water||0)>=WATER_MAX)return state;
    add('water',1);next.stats.waterFetched=(next.stats.waterFetched||0)+1;
  } else if(a.type==='guard_garden') {
    // Stand by the garden at dusk so a coyote is turned away tonight. Once per day, needs a planted garden and someone close to it.
    const day=farmDay(minutes);if(state.farm?.guard?.day===day)return state;
    if(!Object.values(state.cells||{}).some(c=>c.seed))return state;
    if(dist(state.player,gardenFocus(world,state))>6)return state;
    const who=state.characters?.[state.activeCharacter];
    next.farm={...(state.farm||{}),guard:{day,id:state.activeCharacter,name:who?.name||'A friend'}};next.stats.nightsGuarded=(next.stats.nightsGuarded||0)+1;
  } else if(a.type==='dig_stump') {
    if(!world.trees.some(t=>t.id===a.id)||!state.removedTrees.includes(a.id)||(state.removedStumps||[]).includes(a.id))return state;
    next.removedStumps=[...(state.removedStumps||[]),a.id];next.stats.stumps=(next.stats.stumps||0)+1;
  } else return state;
  if(cost)setEnergy(next,energyFor(next)-cost);
  if(a.actionId)next.recentActions=[...(state.recentActions||[]),a.actionId].slice(-128);
  next.village=creditSkill(state.village,state.activeCharacter,a.type);
  return next;
}

/** Where an animal may stand: dry land, clear of building footprints. Returns {ok, reason}. */
export function animalPlacementStatus(world,state,plan){
  return animalSiteStatus(state,plan,{terrain:(x,y)=>terrainType(world,x,y),footprints:activeBuildings(state).map(b=>footprint(world,b).bounds),pointInBounds});
}
export function stateWithoutBuilding(world,state,id){
  const old=state.buildings?.find(b=>b.id===id);if(!old)return state;
  const cells={...state.cells};if(old.kind==='garden')for(const key of footprint(world,old).keys)delete cells[key];
  return {...state,cells,buildings:state.buildings.filter(b=>b.id!==id)};
}
export function buildMoveStatus(world,state,plan,minutes=gameTime(state)){
  const old=state.buildings?.find(b=>b.id===plan.id);if(!old||old.status!=='complete')return {ok:false,reason:'Finish building this first.'};
  if(homeReserved(state,plan.id)||Object.values(state.characters||{}).some(c=>c.sleep?.homeId===plan.id))return {ok:false,reason:'Someone is sleeping or going home here. Wait until the home is free.'};
  if(activeBuildings(state).some(b=>b.status!=='complete'&&!b.project))return {ok:false,reason:'Let Adam finish building first.'};
  const empty=stateWithoutBuilding(world,state,old.id),moved={...plan,kind:old.kind},status=buildSiteStatus(world,empty,moved,minutes);if(!status.ok)return status;
  if((state.woodDrops||[]).some(drop=>pointInBounds(drop,status.footprint.bounds,.2)))return {...status,ok:false,reason:'Pick up the loose logs here before moving your building.'};
  const proposed={...empty,buildings:[...empty.buildings,{...old,key:plan.key,rotation:plan.rotation}]},nav=new Navigation(world,proposed,minutes),work=workPoint(world,moved),path=nav.path(state.player,work);
  return path&&dist(path.at(-1)||state.player,work)<=1.05?{...status,work,path}:{...status,ok:false,reason:'Leave Adam a clear way to reach it.'};
}
export function buildSiteStatus(world,state,plan,minutes=gameTime(state)) {
  const status=siteStatus(world,state,plan,{trees:activeTrees(world,state,minutes),rocks:activeRocks(world,state),terrain:(x,y)=>terrainType(world,x,y),height:(x,y)=>heightAt(world,x,y),inBlocker});
  if(!status.ok)return status;
  const fp=status.footprint,hit=(p,r)=>Math.hypot(p[0]-Math.max(fp.x,Math.min(fp.x+fp.w,p[0])),p[1]-Math.max(fp.y,Math.min(fp.y+fp.h,p[1])))<r;
  if(activeStumps(world,state).some(t=>hit(t.position,stumpRadius(t))))return {ok:false,reason:'Dig out the stump here first. Use the Dig tool on it.',footprint:fp};
  return status;
}
function strokeStanders(state,people){
  const list=[...(people||[])];
  const members=state.community?.members;
  if(members)for(const [id,m] of Object.entries(members)){if(id===state.activeCharacter)continue;if(Number.isFinite(m?.position?.x)&&Number.isFinite(m?.position?.y))list.push(m.position);}
  return list;
}
/** Instant fence and brick strokes. Same ground rules as other buildings, without a walk to each piece. */
export function strokePlacementStatus(world,state,plan,minutes=gameTime(state),people=[]){
  const status=buildSiteStatus(world,state,plan,minutes);if(!status.ok)return status;
  const strokeDef=buildingById(plan.kind);
  if(activeBuildings(state).some(b=>b.status!=='complete'&&!b.project)&&!(strokeDef?.instant&&strokeDef?.stroke))return {...status,ok:false,reason:'Finish your building first.'};
  const need=strokeNeed(state,plan.kind);if(need)return {...status,ok:false,reason:need};
  if(energyFor(state)<BUILD_ENERGY)return {...status,ok:false,reason:'Need 5 energy.'};
  const fp=status.footprint;
  if(strokeStanders(state,people).some(p=>p&&pointInBounds(p,fp.bounds,.4)))return {...status,ok:false,reason:'Someone is standing there.'};
  return status;
}
export function buildUpgradeStatus(world,state,id,minutes=gameTime(state),selectedCrew){
  const old=state.buildings?.find(b=>b.id===id),def=upgradeDefinition(old),plan=def&&upgradePlan(world,old);
  const fail=reason=>({ok:false,reason,plan});
  if(!old||old.status!=='complete')return fail('Finish this home first.');
  if(!def)return fail('This home is already at its highest level.');
  if(homeReserved(state,id)||Object.values(state.characters||{}).some(c=>c.sleep?.homeId===id))return fail('Someone is sleeping or going home here. Wait until the home is free.');
  if(activeBuildings(state).some(b=>b.status!=='complete'&&!b.project))return fail('Let Adam finish building first.');
  const empty=stateWithoutBuilding(world,state,id),site=buildSiteStatus(world,empty,plan,minutes);if(!site.ok)return {...site,plan};
  if(state.constructionVersion===1&&projectPlan(def.id)){const crew=crewStatus(state,def.id,selectedCrew);if(!crew.ok)return {...site,...crew,plan};if(!completedHomesForProject(state).some(h=>h.id!==id))return {...site,ok:false,plan,reason:'Build a Prayer Tent first so your crew can sleep during this upgrade.'};}
  const money=materialStatus(state,def.id,upgradeCost(old));if(!money.ok)return {...site,...money,plan};
  if(energyFor(state)<BUILD_ENERGY)return {...site,...fail('Eat a snack first. Upgrading uses 5 energy.')};
  const proposed={...empty,buildings:[...empty.buildings,{...old,...plan,status:'queued'}]},nav=new Navigation(world,proposed,minutes),work=workPoint(world,plan),path=nav.path(state.player,work);
  return path&&dist(path.at(-1)||state.player,work)<=1.05?{...site,plan,work,path}:{...site,...fail('Leave Adam a clear way to reach the front.')};
}
export function buildPlacementStatus(world,state,plan,minutes=gameTime(state)) {
  const once=buildingById(plan.kind);
  if(once?.once&&activeBuildings(state).some(b=>b.kind===plan.kind&&b.id!==plan.movingId&&b.id!==plan.id))return {ok:false,reason:`One ${once.name} is enough.`};
  const status=buildSiteStatus(world,state,plan,minutes);if(!status.ok)return status;
  if(activeBuildings(state).some(b=>b.status!=='complete'&&!b.project))return {...status,ok:false,reason:'Finish your building first.'};
  if(state.constructionVersion===1&&projectPlan(plan.kind)){const crew=crewStatus(state,plan.kind,plan.crew);if(!crew.ok)return {...status,...crew};if(!completedHomesForProject(state).length)return {...status,ok:false,reason:'Build a Prayer Tent first so your builders can sleep.'};}
  const money=materialStatus(state,plan.kind);if(!money.ok)return {...status,...money};
  if(energyFor(state)<BUILD_ENERGY)return {...status,ok:false,reason:'Eat a snack first. Building uses 5 energy.'};
  const proposed={...state,buildings:[...(state.buildings||[]),{...plan,id:'preview',status:'queued'}]},nav=new Navigation(world,proposed,minutes),work=workPoint(world,plan),path=nav.path(state.player,work);
  if(!path||dist(path.at(-1)||state.player,work)>1.05)return {...status,ok:false,reason:'Adam needs a clear way to reach the front.'};
  return {...status,work,path};
}

// Half-metre navigation raster with clearance around trunks, rocks and fences.
export class Navigation {
  constructor(world,state,minutes=gameTime(state)) {
    this.world=world;this.width=world.grid.columns*2;this.height=world.grid.rows*2;
    this.blocked=new Uint8Array(this.width*this.height);
    const trees=activeTrees(world,state,minutes);
    for(let row=0;row<this.height;row++)for(let col=0;col<this.width;col++){
      const p=this.point(col,row),i=row*this.width+col;
      if(!terrainType(world,p.x,p.y))this.blocked[i]=1;
    }
    const circle=(x,y,r)=>{
      const a=this.cell({x:x-r,y:y-r}),b=this.cell({x:x+r,y:y+r});
      for(let r0=Math.max(0,a.row);r0<=Math.min(this.height-1,b.row);r0++)for(let c=Math.max(0,a.col);c<=Math.min(this.width-1,b.col);c++)if(dist(this.point(c,r0),{x,y})<r)this.blocked[r0*this.width+c]=1;
    };
    for(const t of trees)circle(t.position[0],t.position[1],t.radius+.3);
    for(const b of activeRocks(world,state))circle(b.position[0],b.position[1],b.radius+.28);
    for(const b of [...world.blockers,...buildingBlockers(world,state)]){const [x,y,x1,y1]=b.bounds,a=this.cell({x:x-.22,y:y-.22}),z=this.cell({x:x1+.22,y:y1+.22});for(let r=Math.max(0,a.row);r<=Math.min(this.height-1,z.row);r++)for(let c=Math.max(0,a.col);c<=Math.min(this.width-1,z.col);c++){const p=this.point(c,r);if(inBlocker(b,p.x,p.y,.22))this.blocked[r*this.width+c]=1;}}
    // A finished dock is a pier: its planks are a path, including the part that stands over the water.
    for(const b of activeBuildings(state)){
      if(b.kind!=='dock'||b.status!=='complete')continue;
      const fp=footprint(world,b);if(!fp)continue;
      const [x0,y0,x1,y1]=fp.bounds,a=this.cell({x:x0+.08,y:y0+.08}),z=this.cell({x:x1-.08,y:y1-.08});
      for(let r=Math.max(0,a.row);r<=Math.min(this.height-1,z.row);r++)for(let c=Math.max(0,a.col);c<=Math.min(this.width-1,z.col);c++){
        const p=this.point(c,r);
        if(p.x>x0+.05&&p.x<x1-.05&&p.y>y0+.05&&p.y<y1-.05)this.blocked[r*this.width+c]=0;
      }
    }
    // The permanent fishing pier is scenery rather than a saved building, but its
    // centre planks are still a real path from the beach to the rod at the end.
    const fishingDock=fishingDockLayout(world);
    if(fishingDock)for(let row=0;row<this.height;row++)for(let col=0;col<this.width;col++){
      const p=this.point(col,row);
      if(fishingDockContains(fishingDock,p.x,p.y))this.blocked[row*this.width+col]=0;
    }
  }
  cell(p){return {col:Math.floor((p.x-this.world.grid.origin[0])*2),row:Math.floor((p.y-this.world.grid.origin[1])*2)};}
  point(col,row){return {x:this.world.grid.origin[0]+col*.5+.25,y:this.world.grid.origin[1]+row*.5+.25};}
  free(col,row){return col>=0&&row>=0&&col<this.width&&row<this.height&&!this.blocked[row*this.width+col];}
  nearest(p,radius=3) {
    const c=this.cell(p);let best=null,bd=Infinity;
    for(let y=c.row-radius*2;y<=c.row+radius*2;y++)for(let x=c.col-radius*2;x<=c.col+radius*2;x++)if(this.free(x,y)){const q=this.point(x,y),d=dist(q,p);if(d<bd){best=q;bd=d;}}
    return best;
  }
  path(from,to) {
    const start=this.nearest(from,2),end=this.nearest(to,1);if(!start||!end)return null;
    const a=this.cell(start),b=this.cell(end),W=this.width,si=a.row*W+a.col,ei=b.row*W+b.col;
    const cost=new Float64Array(W*this.height).fill(Infinity),parent=new Int32Array(cost.length).fill(-1),closed=new Uint8Array(cost.length),heap=[];
    const heuristic=i=>{const dx=Math.abs(i%W-b.col),dy=Math.abs(Math.floor(i/W)-b.row);return Math.max(dx,dy)+.41421356*Math.min(dx,dy);};
    const push=(i,f)=>{heap.push({i,f});let k=heap.length-1;while(k){const p=(k-1)>>1;if(heap[p].f<=f)break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p;}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;while(true){let c=k*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[k].f<=heap[c].f)break;[heap[k],heap[c]]=[heap[c],heap[k]];k=c;}}return top.i;};
    cost[si]=0;push(si,heuristic(si));
    while(heap.length){const i=pop();if(closed[i])continue;if(i===ei){const path=[];for(let n=ei;n!==si;n=parent[n]){if(n<0)return null;path.push(this.point(n%W,Math.floor(n/W)));}return path.reverse();}closed[i]=1;const x=i%W,y=Math.floor(i/W);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        if(!this.free(x+dx,y+dy)||(dx&&dy&&(!this.free(x+dx,y)||!this.free(x,y+dy))))continue;
        const j=(y+dy)*W+x+dx,nc=cost[i]+(dx&&dy?Math.SQRT2:1);if(nc<cost[j]){cost[j]=nc;parent[j]=i;push(j,nc+heuristic(j));}
      }
    }return null;
  }
  approach(from,target,distance=1.15,prefer=null) {
    const candidates=[];
    for(let i=0;i<16;i++){const a=i*Math.PI/8,p={x:target.x+Math.cos(a)*distance,y:target.y+Math.sin(a)*distance},c=this.cell(p);if(this.free(c.col,c.row))candidates.push(this.point(c.col,c.row));}
    const score=p=>dist(p,from)+(prefer?6*(1-((p.x-target.x)*prefer.x+(p.y-target.y)*prefer.y)/Math.max(.01,dist(p,target))):0);
    candidates.sort((a,b)=>score(a)-score(b));
    for(const p of candidates){const path=this.path(from,p);if(path)return path;}
    return null;
  }
}

function completedHomesForProject(state){return (state.buildings||[]).filter(b=>b.status==='complete'&&['hut','tent','cottage','townhouse'].includes(b.kind));}
const projectAPI={Navigation,gameTime,workPoint,growth,memberPosition:(member,minutes)=>{const j=member.job;if(!j)return {...member.position};const path=j.path,total=path.slice(1).reduce((n,p,i)=>n+dist(p,path[i]),0);let left=total*Math.max(0,Math.min(1,(minutes-j.start)/Math.max(.001,j.arrive-j.start)));for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=dist(a,b);if(left<=d){const k=d?left/d:1;return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};}left-=d;}return {...path.at(-1)};}};
