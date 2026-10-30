// Building catalogue and deterministic placement rules. Coordinates use the saved one-metre grid.
import {projectProgress,validProject} from './project-rules.mjs';
import {FARM_BUILDINGS} from './farm-rules.mjs';
export const BUILD_ENERGY=5;
export const BUILDINGS=[
  {id:'hut',name:'Small Hut',category:'Homes',size:[3,3],height:3.2,wood:10,stone:5,seconds:15,solid:true,level:1,beds:2,upgradeTo:'cottage',description:'A cozy little home with two beds. Upgrade it as your island grows!'},
  {id:'cottage',name:'Cottage',category:'Homes',size:[5,5],height:3.42,wood:30,stone:17,seconds:25,solid:true,level:2,beds:4,upgradeTo:'townhouse',description:'A timber cottage with a porch and a bedroom for four.'},
  {id:'townhouse',name:'Townhouse',category:'Homes',size:[5,5],height:5.99,wood:65,stone:42,seconds:35,solid:true,level:3,beds:8,description:'A tall two-storey home with eight beds across its furnished upstairs bedrooms.'},
  {id:'church',name:'Church',category:'Community',size:[7,10],height:10.55,wood:120,stone:80,seconds:60,solid:true,description:'A community church with a bell tower, pews and a furnished sanctuary.'},
  {id:'dining_hall',name:'Dining Hall',category:'Community',size:[7,5],height:4.45,wood:70,stone:30,seconds:40,solid:true,poster:'dining_hall',description:'An open timber hall with one long table and benches. Ring the bell and every friend comes to eat together; the meal is served from your bag and leftovers go back.'},
  {id:'market',name:'Market',category:'Community',size:[5,4],height:3.8,wood:60,stone:25,seconds:40,solid:true,description:'Two stalls under a striped awning. Tap a finished market to sell extra fish, garden food, and diamonds for the same gold coins that buy animals.'},
  {id:'dock',name:'Harbour Dock',category:'Community',size:[2,5],height:2.6,wood:45,stone:10,seconds:30,solid:true,description:'A wooden pier with mooring posts and a lantern. Travellers’ boats tie up here, and the friends wave them in.'},
  {id:'tent',name:'Prayer Tent',category:'Homes',size:[3,2],height:2.3,wood:8,stone:0,seconds:10,solid:true,beds:1,once:true,description:'A peaceful green tent for your island. One is enough for the camp.'},
  {id:'chest',name:'Storage Chest',category:'Decorations',size:[2,1],height:1.1,wood:4,stone:2,seconds:6,solid:true,description:'A wooden chest. Your items still live in My bag in this test.'},
  {id:'wood_store_20',name:'Wood Bin',category:'Storage',size:[2,1],height:.85,wood:6,stone:2,seconds:8,solid:true,woodCapacity:20,description:'An open wooden bin. Adds space for 20 wood.'},
  {id:'wood_store_50',name:'Log Rack',category:'Storage',size:[2,2],height:1.62,wood:12,stone:4,seconds:12,solid:true,woodCapacity:50,description:'A covered rack. Adds space for 50 wood.'},
  {id:'wood_store_100',name:'Wood Shed',category:'Storage',size:[3,2],height:2.37,wood:24,stone:8,seconds:18,solid:true,woodCapacity:100,description:'A roomy timber shed. Adds space for 100 wood.'},
  {id:'wood_store_200',name:'Timber Barn',category:'Storage',size:[4,3],height:3.27,wood:40,stone:14,seconds:25,solid:true,woodCapacity:200,description:'Two big storage bays. Adds space for 200 wood.'},
  {id:'garden',name:'Garden Bed',category:'Gardens',size:[2,2],height:.22,wood:3,stone:0,seconds:5,solid:false,description:'Four garden spots, ready to plant when built!'},
  {id:'path',name:'Stone Path',category:'Paths',size:[1,1],height:.12,wood:0,stone:1,seconds:3,solid:false,description:'Little stepping stones you can walk over.'},
  {id:'fence',name:'Wooden Fence',category:'Fences',size:[1,1],height:.7,wood:2,stone:0,seconds:4,solid:true,instant:true,stroke:true,description:'A wooden fence. Tap the grass to place one piece at a time. Animals stay inside a closed pen. Coyotes chew through wood.'},
  {id:'brick_fence',name:'Brick Fence',category:'Fences',size:[1,1],height:.8,wood:0,stone:0,bundle:{concrete_brick:1},seconds:4,solid:true,instant:true,stroke:true,stack:3,description:'A concrete-brick fence. One brick each. Tap the grass to lay a row, and tap the top to stack up to 3. Coyotes barely scratch it.'},
  {id:'brick',name:'Brick Block',category:'Fences',size:[1,1],height:.48,wood:0,stone:0,bundle:{concrete_brick:1},seconds:1,solid:true,instant:true,stroke:true,stack:3,description:'One brick. Tap the grass to lay a row, and tap the top to stack up to 3 high.'},
  {id:'scarecrow',name:'Scarecrow',category:'Fences',size:[1,1],height:1.8,wood:4,stone:0,bundle:{wheat:2},seconds:4,solid:false,instant:true,description:'Wheat-straw scarecrow. Crows keep away from a 10×10 metre patch around it.'},
  {id:'stable',name:'Stable',category:'Fences',size:[3,2],height:2.4,wood:20,stone:8,seconds:8,solid:true,instant:true,poster:'hut',description:'A night stable for sheep, cows and horses. Sheep left outside after day 7 can go missing.'},
  {id:'campfire',name:'Campfire',category:'Decorations',size:[2,2],height:1.3,wood:5,stone:3,seconds:7,solid:true,description:'A warm, flickering fire that glows at night.'},
  {id:'forge',name:'Forge',category:'Decorations',size:[2,2],height:1.8,wood:12,stone:16,seconds:18,solid:true,description:'A stone forge with a hot hearth. Copper, iron, and diamond tools, and metal shovels, are made here.'},
  {id:'oven',name:'Clay Oven',category:'Decorations',size:[2,2],height:1.7,wood:0,stone:20,clay:6,seconds:600,solid:true,description:'A stone oven lined with clay bricks. Light it with a log, let it heat up, then bake wheat and water into manna.'},
  {id:'well',name:'Water Well',category:'Gardens',size:[2,2],height:2.3,wood:8,stone:14,seconds:14,solid:true,requiresShovel:1,description:'Dig down to fresh water. With a well on the island, watering the garden costs no energy.'},
  ...FARM_BUILDINGS, // Adam's water trough and feed pile (farm-rules.mjs)
];
export const buildingById=id=>BUILDINGS.find(b=>b.id===id);
export const woodTotal=state=>Object.entries(state.inventory).filter(([id])=>id.endsWith('_wood')).reduce((n,[,v])=>n+v,0);
export const activeBuildings=state=>(state.buildings||[]).filter(b=>b.status!=='cancelled');
/**
 * One Prayer Tent is the whole camp roof. When a save has a pile, keep the first and drop the
 * rest with no material refund. Other building kinds are left alone. Sleep spots in a dropped
 * copy move to the tent that stays.
 */
export function collapsePrayerTents(state){
  const buildings=state?.buildings;
  if(!Array.isArray(buildings))return state;
  const live=[];
  for(const b of buildings)if(b&&b.kind==='tent'&&b.status!=='cancelled')live.push(b);
  if(live.length<2)return state;
  const keep=live[0],drop=new Set(live.slice(1).map(b=>b.id));
  const next={...state,buildings:buildings.filter(b=>!drop.has(b?.id))};
  if(state.characters&&Object.values(state.characters).some(c=>drop.has(c?.sleep?.homeId))){
    const characters={...state.characters};
    for(const [id,c] of Object.entries(characters))if(drop.has(c?.sleep?.homeId))characters[id]={...c,sleep:{...c.sleep,homeId:keep.id}};
    next.characters=characters;
  }
  if(state.night?.homes&&Object.values(state.night.homes).some(id=>drop.has(id))){
    const homes={...state.night.homes};
    for(const [id,homeId] of Object.entries(homes))if(drop.has(homeId))homes[id]=keep.id;
    next.night={...state.night,homes};
  }
  return next;
}
export const completedFires=state=>activeBuildings(state).filter(b=>b.kind==='campfire'&&b.status==='complete');
/** Every finished home sleeps a few friends; a new friend can only move in when there is a bed for them. */
export const bedCount=state=>activeBuildings(state).filter(b=>b.status==='complete').reduce((n,b)=>n+(buildingById(b.kind)?.beds||0),0);
export const completedOvens=state=>activeBuildings(state).filter(b=>b.kind==='oven'&&b.status==='complete');
/** Anything that burns logs: campfires and clay ovens. */
export const heatSources=state=>activeBuildings(state).filter(b=>['campfire','oven'].includes(b.kind)&&b.status==='complete');
/** The oven holds heat: one log burns 6 island hours, but a cold oven needs ~100 island minutes (about 40 real seconds) to get hot enough to bake. */
export const OVEN_LOG_MINUTES=360,OVEN_MAX_LOGS=2,OVEN_WARMUP_MINUTES=100;
export const logMinutesFor=b=>b.kind==='oven'?OVEN_LOG_MINUTES:FIRE_LOG_MINUTES;
export const maxLogsFor=b=>b.kind==='oven'?OVEN_MAX_LOGS:FIRE_MAX_LOGS;
export const ovenWarmth=(b,minutes)=>fireFuelLeft(b,minutes)>0?Math.max(0,Math.min(1,(minutes-(b.litAt??minutes))/OVEN_WARMUP_MINUTES)):0;
export const ovenIsHot=(b,minutes)=>ovenWarmth(b,minutes)>=1;
export const hotOvens=(state,minutes)=>completedOvens(state).filter(b=>ovenIsHot(b,minutes));
/** A campfire burns one log for 2 island hours; it can hold a few logs' worth at once. */
export const FIRE_LOG_MINUTES=120,FIRE_MAX_LOGS=4,FIRE_LOW_MINUTES=30;
export const fireFuelLeft=(b,minutes)=>Math.max(0,(b.fuelUntil??0)-minutes);
export const fireIsLit=(b,minutes)=>fireFuelLeft(b,minutes)>0;
export const litFires=(state,minutes)=>completedFires(state).filter(b=>fireIsLit(b,minutes));
/** Fires that are out or about to go out and could take another log. */
export const firesNeedingLog=(state,minutes)=>completedFires(state).filter(b=>fireFuelLeft(b,minutes)<FIRE_LOW_MINUTES);
export const fireCanTakeLog=(b,minutes)=>fireFuelLeft(b,minutes)+logMinutesFor(b)<=maxLogsFor(b)*logMinutesFor(b)+1;
export function footprint(world,plan){
 const def=buildingById(plan.kind);if(!def||!/^\d{1,3}:\d{1,3}$/.test(plan.key||'')||!Number.isInteger(plan.rotation)||plan.rotation<0||plan.rotation>3)return null;
 const [col,row]=plan.key.split(':').map(Number),[w,h]=plan.rotation%2?[...def.size].reverse():def.size;
 const x=world.grid.origin[0]+col,y=world.grid.origin[1]+row;
 return {col,row,w,h,x,y,center:{x:x+w/2,y:y+h/2},bounds:[x,y,x+w,y+h],keys:Array.from({length:w*h},(_,i)=>`${col+i%w}:${row+Math.floor(i/w)}`)};
}
export function pointInBounds(p,b,margin=0){return p.x>b[0]-margin&&p.x<b[2]+margin&&p.y>b[1]-margin&&p.y<b[3]+margin;}
export function boundsOverlap(a,b){return a[0]<b[2]-.001&&a[2]>b[0]+.001&&a[1]<b[3]-.001&&a[3]>b[1]+.001;}
export function buildingBlockers(world,state){return activeBuildings(state).filter(b=>buildingById(b.kind)?.solid).map(b=>({id:b.id,bounds:footprint(world,b).bounds}));}
export function workPoint(world,b){const fp=footprint(world,b),def=buildingById(b.kind),angle=b.rotation*Math.PI/2;return {x:fp.center.x+Math.sin(angle)*(def.size[1]/2+.85),y:fp.center.y-Math.cos(angle)*(def.size[1]/2+.85)};}
export const upgradeDefinition=b=>buildingById(buildingById(b?.kind)?.upgradeTo);
export function upgradeCost(b){const from=buildingById(b?.kind),to=upgradeDefinition(b);return to?{wood:to.wood-from.wood,stone:to.stone-from.stone}:null;}
export function upgradePlan(world,b){
 const to=upgradeDefinition(b);if(!to)return null;const fp=footprint(world,b),[w,h]=b.rotation%2?[...to.size].reverse():to.size;
 return {id:b.id,upgradingId:b.id,kind:to.id,key:`${fp.col+(fp.w-w)/2}:${fp.row+(fp.h-h)/2}`,rotation:b.rotation};
}
export function materialStatus(state,kind,cost=null){
 const def=cost||buildingById(kind);if(!def)return {ok:false,reason:'Choose something to build.'};
 const shovel=buildingById(kind)?.requiresShovel||0;if(shovel&&(state.tools?.shovel||0)<shovel)return {ok:false,needsShovel:shovel,reason:'Needs a shovel to dig. Make one in Tools.'};
 const wood=woodTotal(state),stone=state.inventory.stone||0;
 if(wood<def.wood)return {ok:false,reason:`Collect ${def.wood-wood} more wood. Chop a tree!`};
 if(stone<def.stone)return {ok:false,reason:`Collect ${def.stone-stone} more stone. Smash a rock!`};
 const clay=state.inventory.clay||0;if((def.clay||0)>clay)return {ok:false,reason:`Make ${def.clay-clay} more clay brick${def.clay-clay===1?'':'s'}. Dig mud at the beach, add water, and dry it by the campfire.`};
 for(const [id,n] of Object.entries(def.bundle||{})){const have=state.inventory[id]||0;if(have<n)return {ok:false,reason:id==='concrete_brick'?`Make ${n-have} more concrete brick${n-have===1?'':'s'} at the well (2 stone + 1 clay).`:`Need ${n-have} more wheat for the scarecrow. Harvest wheat.`};}
 return {ok:true,reason:'Materials ready!'};
}
export function spendMaterials(state,kind,cost=null){
 const def=cost||buildingById(kind),paid={};let left=def.wood;
 for(const id of Object.keys(state.inventory).filter(id=>id.endsWith('_wood')).sort()){
  const n=Math.min(left,state.inventory[id]);if(n){state.inventory[id]-=n;paid[id]=n;left-=n;}if(!left)break;
 }
 if(def.stone){state.inventory.stone-=def.stone;paid.stone=def.stone;}
 if(def.clay){state.inventory.clay-=def.clay;paid.clay=def.clay;}
 for(const [id,n] of Object.entries(def.bundle||{})){state.inventory[id]=(state.inventory[id]||0)-n;paid[id]=n;}
 return paid;
}
export function layerCount(b){const n=b?.layers;return Number.isInteger(n)&&n>0?n:1;}
export function addPaid(paid,extra){for(const [id,n] of Object.entries(extra||{}))if(n)paid[id]=(paid[id]||0)+n;}
/** Drop one paid layer when the top of a stack falls. The building must still have a layer left. */
export function subtractLayer(paid,def){
 if(!paid||!def)return;let left=def.wood||0;
 for(const id of Object.keys(paid).filter(id=>id.endsWith('_wood')).sort()){const n=Math.min(left,paid[id]||0);paid[id]-=n;if(paid[id]<=0)delete paid[id];left-=n;if(!left)break;}
 if(def.stone){paid.stone=(paid.stone||0)-def.stone;if(paid.stone<=0)delete paid.stone;}
 if(def.clay){paid.clay=(paid.clay||0)-def.clay;if(paid.clay<=0)delete paid.clay;}
 for(const [id,n] of Object.entries(def.bundle||{})){paid[id]=(paid[id]||0)-n;if(paid[id]<=0)delete paid[id];}
}
/** Short line for a stroke the kid cannot afford. Null when the materials are ready. */
export function strokeNeed(state,kind){
 const def=buildingById(kind);if(!def)return 'Choose something to build.';
 if((def.wood||0)>woodTotal(state))return `Need ${def.wood} wood.`;
 if((def.stone||0)>(state.inventory.stone||0))return `Need ${def.stone} stone.`;
 if((def.clay||0)>(state.inventory.clay||0))return `Need ${def.clay} clay.`;
 for(const [id,n] of Object.entries(def.bundle||{}))if((state.inventory[id]||0)<n)return id==='concrete_brick'?`Need ${n} brick${n===1?'':'s'}.`:`Need ${n} wheat.`;
 return null;
}
/** Long axis along X at rotation 0. A corner keeps one straight piece, turned toward the newer neighbor. */
export function strokeRotation(buildings,key,kind,preferKey){
 const [c,r]=String(key||'').split(':').map(Number);
 if(!Number.isInteger(c)||!Number.isInteger(r))return 0;
 const live=b=>b&&b.status!=='cancelled'&&b.kind===kind;
 const has=(dc,dr)=>(buildings||[]).some(b=>live(b)&&b.key===`${c+dc}:${r+dr}`);
 const ew=has(1,0)||has(-1,0),ns=has(0,1)||has(0,-1);
 if(ew&&ns&&preferKey){const [pc,pr]=String(preferKey).split(':').map(Number);if(pc===c&&pr!==r)return 1;if(pr===r&&pc!==c)return 0;}
 return ns&&!ew?1:0;
}
export function orientStrokeNeighbors(buildings,key,kind){
 const [c,r]=String(key||'').split(':').map(Number);if(!Number.isInteger(c))return;
 const around=new Set([key,`${c+1}:${r}`,`${c-1}:${r}`,`${c}:${r+1}`,`${c}:${r-1}`]);
 for(const b of buildings||[]){if(!b||b.status==='cancelled'||b.kind!==kind||!around.has(b.key))continue;b.rotation=strokeRotation(buildings,b.key,kind,b.key===key?null:key);}
}
export function siteStatus(world,state,plan,{trees,rocks,terrain,height,inBlocker}){
 const fp=footprint(world,plan),def=buildingById(plan.kind),fail=reason=>({ok:false,reason,footprint:fp});
 if(!fp)return fail('Choose a building and a grid spot.');
 if(fp.col<0||fp.row<0||fp.col+fp.w>world.grid.columns||fp.row+fp.h>world.grid.rows)return fail('Keep your building on the island.');
 const heights=[];
 for(let r=0;r<fp.h;r++)for(let c=0;c<fp.w;c++){
  const x=fp.x+c+.5,y=fp.y+r+.5,key=`${fp.col+c}:${fp.row+r}`;
  if(terrain(x,y)!==2)return fail('Choose flat grass, away from the beach and water.');
  if(state.cells[key]?.soil||world.gardenSlots.some(s=>s.key===key))return fail('Keep your garden spots free for plants.');
  // One-tile pieces (fence, path, scarecrow) may butt up against the scenery's own fence ends; bigger buildings keep a little room.
  const slim=def.size[0]===1&&def.size[1]===1,reach=slim?.3:.45,margin=slim?0:.12;
  for(const dx of [-reach,0,reach])for(const dy of [-reach,0,reach]){
   heights.push(height(x+dx,y+dy));if(world.blockers.some(b=>inBlocker(b,x+dx,y+dy,margin)))return fail('Leave space around rocks, paths and fences.');
  }
 }
 if(Math.max(...heights)-Math.min(...heights)>.28)return fail('That ground is too steep. Try flatter grass.');
 // Finished and in-progress buildings both hold their cells. A missing footprint must not skip the rest.
 const occupied=activeBuildings(state).map(b=>footprint(world,b)).filter(Boolean);
 if(occupied.some(o=>boundsOverlap(fp.bounds,o.bounds)||o.keys.some(k=>fp.keys.includes(k))))return fail('Another building already has that spot.');
 const circleHits=(x,y,r)=>Math.hypot(x-Math.max(fp.x,Math.min(fp.x+fp.w,x)),y-Math.max(fp.y,Math.min(fp.y+fp.h,y)))<r;
 if(trees.some(t=>circleHits(t.position[0],t.position[1],t.radius+.4)))return fail('Chop the tree here first, or choose another spot.');
 if(rocks.some(r=>circleHits(r.position[0],r.position[1],r.radius+.16)))return fail('Smash the rock here first, or choose another spot.');
 if(world.seeds.some(s=>!state.pickedSeeds.includes(s.id)&&circleHits(s.position[0],s.position[1],.20)))return fail('Pick up the seeds here first.');
 if(pointInBounds(state.player,fp.bounds,.4))return fail('Leave Adam space to stand! Try a little farther away.');
 if(def.solid&&circleHits(world.heroStart[0],world.heroStart[1],.7))return fail('Leave Adam’s starting spot free.');
 if(world.fishingSpots?.some(s=>circleHits(s.position[0],s.position[1],.7)))return fail('Keep the fishing shore free.');
 return {ok:true,reason:'A great spot!',footprint:fp,baseHeight:Math.max(...heights)+.015};
}
export function buildingProgress(b,wall=Date.now()){
 if(b.status==='complete')return 1;if(b.project)return projectProgress(b);if(b.status!=='building')return 0;
 return Math.min(1,Math.max(0,(wall-b.startedAt)/(buildingById(b.kind).seconds*1000)));
}
export function buildingStage(b,wall=Date.now()){
 const p=buildingProgress(b,wall);return b.status==='complete'?'complete':p<.25?'foundation':p<.75?'frame':'finishing';
}
export function validBuildings(value,world){
 if(value===undefined)return true;if(!Array.isArray(value)||value.length>2000)return false;
 const ids=new Set();return value.every(b=>{
  const def=buildingById(b?.kind),fp=b&&footprint(world,b);if(!validProject(b?.project,b?.kind)||!def||!fp||typeof b.id!=='string'||!b.id||b.id.length>128||ids.has(b.id)||!['queued','building','complete','cancelled'].includes(b.status))return false;
  ids.add(b.id);if(fp.col+fp.w>world.grid.columns||fp.row+fp.h>world.grid.rows||!Number.isFinite(b.baseHeight))return false;
  if(['building','complete'].includes(b.status)&&!Number.isFinite(b.startedAt))return false;
  if(b.jobId!==undefined&&(typeof b.jobId!=='string'||!b.jobId||b.jobId.length>128))return false;
  if(b.upgradeFrom!==undefined){
   const old=b.upgradeFrom,plan=upgradePlan(world,old);
   if(!old||old.upgradeFrom||old.id!==b.id||old.status!=='complete'||!['queued','building'].includes(b.status)||!validBuildings([old],world)||!plan||plan.kind!==b.kind||plan.key!==b.key||plan.rotation!==b.rotation||!b.jobId)return false;
   if(Object.entries(old.paidMaterials).some(([id,n])=>(b.paidMaterials?.[id]||0)<n))return false;
  }
  const layers=b.layers===undefined?1:b.layers;if(!Number.isInteger(layers)||layers<1||layers>(def.stack||1))return false;
  const paid=b.paidMaterials,bundle=def.bundle||{};if(!paid||Object.entries(paid).some(([id,n])=>!(id==='stone'||id==='clay'||id.endsWith('_wood')||bundle[id])||!Number.isInteger(n)||n<=0))return false;
  if(Object.entries(bundle).some(([id,n])=>(paid[id]||0)!==n*layers))return false;
  return Object.entries(paid).filter(([id])=>id.endsWith('_wood')).reduce((n,[,v])=>n+v,0)===def.wood*layers&&(paid.stone||0)===def.stone*layers&&(paid.clay||0)===(def.clay||0)*layers;
 });
}
