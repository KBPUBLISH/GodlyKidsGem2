// Building catalogue and deterministic placement rules. Coordinates use the saved one-metre grid.
import {projectProgress,validProject} from './project-rules.mjs';
export const BUILD_ENERGY=5;
export const BUILDINGS=[
  {id:'hut',name:'Small Hut',category:'Homes',size:[3,3],height:3.2,wood:10,stone:5,seconds:15,solid:true,level:1,beds:1,upgradeTo:'cottage',description:'A cozy little home. Upgrade it as your island grows!'},
  {id:'cottage',name:'Cottage',category:'Homes',size:[5,5],height:3.42,wood:30,stone:17,seconds:25,solid:true,level:2,beds:2,upgradeTo:'townhouse',description:'A timber cottage with a porch and a cozy bedroom.'},
  {id:'townhouse',name:'Townhouse',category:'Homes',size:[5,5],height:5.99,wood:65,stone:42,seconds:35,solid:true,level:3,beds:4,description:'A tall two-storey home with a furnished upstairs bedroom.'},
  {id:'church',name:'Church',category:'Community',size:[7,10],height:10.55,wood:120,stone:80,seconds:60,solid:true,description:'A community church with a bell tower, pews and a furnished sanctuary.'},
  {id:'tent',name:'Prayer Tent',category:'Homes',size:[3,2],height:2.3,wood:8,stone:0,seconds:10,solid:true,beds:1,description:'A peaceful green tent for your island.'},
  {id:'chest',name:'Storage Chest',category:'Decorations',size:[2,1],height:1.1,wood:4,stone:2,seconds:6,solid:true,description:'A wooden chest. Your items still live in My bag in this test.'},
  {id:'wood_store_20',name:'Wood Bin',category:'Storage',size:[2,1],height:.85,wood:6,stone:2,seconds:8,solid:true,woodCapacity:20,description:'An open wooden bin. Adds space for 20 wood.'},
  {id:'wood_store_50',name:'Log Rack',category:'Storage',size:[2,2],height:1.62,wood:12,stone:4,seconds:12,solid:true,woodCapacity:50,description:'A covered rack. Adds space for 50 wood.'},
  {id:'wood_store_100',name:'Wood Shed',category:'Storage',size:[3,2],height:2.37,wood:24,stone:8,seconds:18,solid:true,woodCapacity:100,description:'A roomy timber shed. Adds space for 100 wood.'},
  {id:'wood_store_200',name:'Timber Barn',category:'Storage',size:[4,3],height:3.27,wood:40,stone:14,seconds:25,solid:true,woodCapacity:200,description:'Two big storage bays. Adds space for 200 wood.'},
  {id:'garden',name:'Garden Bed',category:'Gardens',size:[2,2],height:.22,wood:3,stone:0,seconds:5,solid:false,description:'Four garden spots, ready to plant when built!'},
  {id:'path',name:'Stone Path',category:'Paths',size:[1,1],height:.12,wood:0,stone:1,seconds:3,solid:false,description:'Little stepping stones you can walk over.'},
  {id:'fence',name:'Wooden Fence',category:'Fences',size:[1,1],height:.7,wood:2,stone:0,seconds:4,solid:true,description:'A fence for the edge of your garden. Leave a way in!'},
  {id:'campfire',name:'Campfire',category:'Decorations',size:[2,2],height:1.3,wood:5,stone:3,seconds:7,solid:true,description:'A warm, flickering fire that glows at night.'},
  {id:'oven',name:'Clay Oven',category:'Decorations',size:[2,2],height:1.7,wood:0,stone:20,clay:6,seconds:600,solid:true,description:'A stone oven lined with clay bricks. Light it with a log, let it heat up, then bake wheat and water into manna.'},
  {id:'well',name:'Water Well',category:'Gardens',size:[2,2],height:2.3,wood:8,stone:14,seconds:14,solid:true,requiresShovel:1,description:'Dig down to fresh water. With a well on the island, watering the garden costs no energy.'},
];
export const buildingById=id=>BUILDINGS.find(b=>b.id===id);
export const woodTotal=state=>Object.entries(state.inventory).filter(([id])=>id.endsWith('_wood')).reduce((n,[,v])=>n+v,0);
export const activeBuildings=state=>(state.buildings||[]).filter(b=>b.status!=='cancelled');
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
 return {ok:true,reason:'Materials ready!'};
}
export function spendMaterials(state,kind,cost=null){
 const def=cost||buildingById(kind),paid={};let left=def.wood;
 for(const id of Object.keys(state.inventory).filter(id=>id.endsWith('_wood')).sort()){
  const n=Math.min(left,state.inventory[id]);if(n){state.inventory[id]-=n;paid[id]=n;left-=n;}if(!left)break;
 }
 if(def.stone){state.inventory.stone-=def.stone;paid.stone=def.stone;}
 if(def.clay){state.inventory.clay-=def.clay;paid.clay=def.clay;}
 return paid;
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
  for(const dx of [-.45,0,.45])for(const dy of [-.45,0,.45]){
   heights.push(height(x+dx,y+dy));if(world.blockers.some(b=>inBlocker(b,x+dx,y+dy,.12)))return fail('Leave space around rocks, paths and fences.');
  }
 }
 if(Math.max(...heights)-Math.min(...heights)>.28)return fail('That ground is too steep. Try flatter grass.');
 if(activeBuildings(state).some(b=>boundsOverlap(fp.bounds,footprint(world,b).bounds)))return fail('Another building already has that spot.');
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
  const paid=b.paidMaterials;if(!paid||Object.entries(paid).some(([id,n])=>!(id==='stone'||id==='clay'||id.endsWith('_wood'))||!Number.isInteger(n)||n<=0))return false;
  return Object.entries(paid).filter(([id])=>id.endsWith('_wood')).reduce((n,[,v])=>n+v,0)===def.wood&&(paid.stone||0)===def.stone&&(paid.clay||0)===(def.clay||0);
 });
}
