/**
 * Foreman check-in. Each brain calls `checkIn` before it starts work on its own.
 *
 * The island's goals are the stage ladder in stages.mjs (Camp → Homestead → Village →
 * Harbour Town). Tracks are people, buildings, garden, food, and animals when the
 * stage asks for a flock. A brain stays in its lane:
 *   cook (Eve) — food and meals
 *   gardener (Abel) — the garden
 *   farmer (Adam) — the flock and its one paddock
 *   builder (Noah) — the one next building the ladder still needs
 *
 * A new building, expansion, or project is allowed only when that lane is the lagging
 * track, or it is this friend's today-goal (`village.todayGoals`). Maintenance of
 * something that already exists (water, weed, feed, a scheduled meal) is allowed.
 * The character the kid is playing is never puppeted.
 *
 * Autonomous buildings sit on one camp row, set back from the dock and the beach,
 * not on the first empty grass. Homes stay together, work buildings stay together,
 * and the prayer tent and church keep space around them. Each new one keeps about
 * two clear tiles from the last and faces the same way. A hand placement never
 * calls this. If the row would touch another footprint or the water, the answer
 * is no and the crew waits.
 */
import {minutesAt} from './island-clock.mjs';
import {activeBuildings,buildingById,footprint} from './building.mjs';
import {islandJourney,STAGE_LADDER} from './stages.mjs';
import {focusFor} from './today-goals.mjs';
import {noteEvent} from './island-feed.mjs';

const GRID={grid:{origin:[0,0]}};
const NOT_BUILDING=new Set(['people','food','garden','animals']);
const HOME_RANK={tent:0,hut:1,cottage:2,townhouse:3};
/** One of each, ever. A queued copy counts — never start a second. */
export const UNIQUE_BUILDINGS=new Set(['tent','campfire','well','dining_hall','market','dock','church']);
const MAINTAIN=new Set(['maintain','meal','water','weed','feed','tend','stoke','guard','chase','repair','check','herd','harvest','plant']);

const BRAIN_LANE={
  cook:'food',eve:'food',feeder:'food',kitchen:'food',
  gardener:'garden',abel:'garden',garden:'garden',
  farmer:'animals',adam:'animals',flock:'animals',
  builder:'buildings',noah:'buildings',buildings:'buildings',
};
const GOAL_LANE={
  garden:'garden',guard:'garden',
  buildings:'buildings',raise:'buildings',wood:'buildings',
  flock:'animals',
  feed:'food',kitchen:'food',
};

const laneOf=brain=>BRAIN_LANE[String(brain||'').toLowerCase()]||null;

function characterId(state,who){
  if(who==null||who==='')return null;
  if(state?.characters?.[who])return who;
  const w=String(who).toLowerCase();
  for(const [id,c] of Object.entries(state?.characters||{})){
    if(id.toLowerCase()===w||String(c?.name||'').toLowerCase()===w)return id;
  }
  return String(who);
}

function isPlayed(state,who){
  const active=state?.activeCharacter;
  if(!active||who==null||who==='')return false;
  if(who===active)return true;
  const id=characterId(state,who);
  return id===active;
}

export function islandHour(state){
  const clock=state?.clock;
  if(!clock||!Number.isFinite(clock.minutes))return 0;
  try{return Math.floor(minutesAt(clock,Date.now())/60);}catch{return Math.floor(clock.minutes/60);}
}

function countKind(state,kind){
  return activeBuildings(state).filter(b=>b.kind===kind).length;
}

/** The first building the ladder still lacks, walking Camp → Harbour Town. Garden stays Abel's track. */
export function nextBuildingGoal(state){
  for(const stage of STAGE_LADDER){
    for(const req of stage.requirements){
      if(NOT_BUILDING.has(req.id))continue;
      const have=Math.max(0,req.have(state)|0);
      if(have<req.need)return {id:req.id,label:req.label,short:req.short||req.label,need:req.need,have,stage:stage.name,stageId:stage.id};
    }
  }
  return null;
}

function meetsGoal(kind,goalId){
  if(!kind||!goalId)return false;
  if(kind===goalId)return true;
  if(HOME_RANK[goalId]!==undefined&&HOME_RANK[kind]!==undefined)return HOME_RANK[kind]>=HOME_RANK[goalId];
  return false;
}

function isMaintenance(intent){
  if(!intent)return false;
  if(intent.maintenance)return true;
  return MAINTAIN.has(intent.action);
}

function placingBuilding(intent){
  if(!intent?.kind||isMaintenance(intent))return false;
  if(intent.action==='fence'||intent.action==='expand'||intent.action==='paddock'||intent.action==='craft'||intent.action==='cook')return false;
  return intent.action==='build'||intent.action==='place'||intent.action==='upgrade'||UNIQUE_BUILDINGS.has(intent.kind)||HOME_RANK[intent.kind]!==undefined;
}

function workLane(intent,brainLane){
  if(isMaintenance(intent))return brainLane;
  const action=intent?.action;
  if(action==='craft'||action==='cook')return 'food';
  if(action==='expand'||action==='fence'||intent?.newRing)return 'garden';
  if(action==='paddock'||action==='stable')return 'animals';
  if(action==='build'||action==='place'||action==='upgrade'||intent?.kind)return 'buildings';
  return brainLane;
}

function trackFrom(r){
  const need=r.need||1,have=r.have||0;
  return {id:r.id,label:r.label,short:r.short||r.label,have,need,done:!!r.done,ratio:need?have/need:1};
}

/** Live tracks for the stage the island is in, and the one furthest from done. */
export function trackBoard(state){
  const journey=islandJourney(state||{});
  const stage=journey.next||journey.stages?.[journey.stages.length-1];
  const reqs=stage?.requirements||[];
  const tracks=[];
  const people=reqs.find(r=>r.id==='people');
  if(people)tracks.push(trackFrom(people));
  const builds=reqs.filter(r=>!NOT_BUILDING.has(r.id));
  if(builds.length){
    const have=builds.reduce((n,r)=>n+r.have,0),need=builds.reduce((n,r)=>n+r.need,0);
    tracks.push({id:'buildings',label:'Buildings',short:'Buildings',have,need,done:have>=need,ratio:need?have/need:1});
  }
  for(const id of ['garden','food','animals']){
    const r=reqs.find(x=>x.id===id);
    if(r)tracks.push(trackFrom(r));
  }
  let lagging=null;
  for(const t of tracks){if(t.done)continue;if(!lagging||t.ratio<lagging.ratio)lagging=t;}
  return {stageName:stage?.name||journey.stage?.name||'Camp',stageId:stage?.id||journey.stage?.id||'camp',tracks,lagging};
}

function laggingInstead(board,intent){
  const lag=board.lagging,stage=board.stageName||'Camp';
  if(!lag)return `${stage} has what it needs.`;
  if(lag.id==='food')return 'Food is behind — cook';
  if(lag.id==='garden')return 'The garden fence is open';
  if(lag.id==='people')return 'More friends need to come ashore';
  if(lag.id==='animals')return 'The flock is behind — tend the animals';
  if(lag.id==='buildings'){
    if(intent?.kind==='tent')return `${stage} still needs the next building, not another tent`;
    return `${stage} still needs the next building`;
  }
  return `${lag.short||'That'} is behind`;
}

function wrongBuildingInstead(state,intent){
  const next=nextBuildingGoal(state);
  const stage=next?.stage||'Camp';
  if(intent?.kind==='tent'){
    if(next?.id==='hut')return `${stage} still needs a Small Hut, not another tent`;
    return `${stage} still needs the next building, not another tent`;
  }
  const tried=(buildingById(intent?.kind)?.name||'that').toLowerCase();
  if(next?.id==='hut')return `${stage} still needs a Small Hut, not another ${tried}`;
  if(next)return `${stage} still needs the next building, not another ${tried}`;
  return `${stage} still needs the next building`;
}

function occupied(state){
  const keys=new Set();
  for(const b of activeBuildings(state)){
    const fp=footprint(GRID,b);
    if(!fp)continue;
    for(const k of fp.keys)keys.add(k);
  }
  return keys;
}

function planKeys(intent){
  if(!intent?.kind||!intent?.key)return null;
  const rotation=Number.isInteger(intent.rotation)?intent.rotation:0;
  const fp=footprint(GRID,{kind:intent.kind,key:String(intent.key),rotation});
  return fp?.keys||null;
}

function todayMatches(state,who,lane){
  if(!state?.village?.todayGoals||!lane)return false;
  try{
    const id=characterId(state,who);
    const name=state.characters?.[id]?.name||who;
    const focus=focusFor(state,id,name);
    return !!focus&&focus.id!=='off'&&GOAL_LANE[focus.id]===lane;
  }catch{return false;}
}

function fail(reason,instead){return {ok:false,reason,instead};}
function pass(){return {ok:true,reason:null,instead:null};}

/** Clear tiles between footprints. Touching is 0. Sacred buildings keep a wider berth. */
export const CAMP_GAP=2;
const SACRED_GAP=3;
const SETBACK=4;
const FACING=0;
const NO_ROOM='No room in the row yet';
/** How far along the one camp row each group starts, so homes stay together and the tent keeps its own space. */
const GROUP_AT={sacred:0,homes:14,work:22,civic:28,flock:38,plots:44};

/** Which row a building belongs on. Strokes, paths and fence pieces are not camp buildings. */
const CAMP_LANE={
  tent:'sacred',church:'sacred',
  hut:'homes',cottage:'homes',townhouse:'homes',
  campfire:'work',oven:'work',well:'work',forge:'work',
  dining_hall:'civic',market:'civic',chest:'civic',
  wood_store_20:'civic',wood_store_50:'civic',wood_store_100:'civic',wood_store_200:'civic',
  stable:'flock',
  garden:'plots',
  dock:'harbour',
};

const noRoom=()=>fail(NO_ROOM,NO_ROOM);

function gridSize(world){
  const g=world?.grid;
  if(g?.columns&&g?.rows)return {columns:g.columns,rows:g.rows,origin:g.origin||[0,0]};
  return {columns:64,rows:64,origin:[0,0]};
}

function terrainAt(world,col,row){
  const {columns,rows}=gridSize(world);
  if(col<0||row<0||col>=columns||row>=rows)return 0;
  const mask=world?.grid?.mask;
  if(!mask)return row<3?1:2;
  return mask[row*columns+col];
}

function boxGap(a,b){
  const gapC=a.col>=b.col+b.w?a.col-(b.col+b.w):b.col>=a.col+a.w?b.col-(a.col+a.w):-1;
  const gapR=a.row>=b.row+b.h?a.row-(b.row+b.h):b.row>=a.row+a.h?b.row-(a.row+a.h):-1;
  if(gapC<0&&gapR<0)return -1;
  if(gapC<0)return gapR;
  if(gapR<0)return gapC;
  return Math.max(gapC,gapR);
}

function needGap(a,b){
  const sacred=k=>k==='tent'||k==='church';
  return sacred(a)||sacred(b)?SACRED_GAP:CAMP_GAP;
}

function placedFootprints(state){
  const out=[];
  for(const b of activeBuildings(state)){
    const fp=footprint(GRID,b);
    if(!fp)continue;
    out.push({kind:b.kind,col:fp.col,row:fp.row,w:fp.w,h:fp.h});
  }
  return out;
}

function grassCentroid(world){
  const {columns,rows}=gridSize(world);
  let sx=0,sy=0,n=0;
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
    if(terrainAt(world,c,r)!==2)continue;
    sx+=c;sy+=r;n++;
  }
  return n?{c:sx/n,r:sy/n}:null;
}

function nearestGrass(world,c,r){
  const {columns,rows}=gridSize(world);
  const c0=Math.max(0,Math.min(columns-1,Math.round(c)));
  const r0=Math.max(0,Math.min(rows-1,Math.round(r)));
  let best=null,bestD=Infinity;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    if(terrainAt(world,col,row)!==2)continue;
    const d=(col-c0)**2+(row-r0)**2;
    if(d<bestD){bestD=d;best={c:col,r:row};}
  }
  return best;
}

function shoreTarget(state,world){
  const {origin}=gridSize(world);
  const dock=activeBuildings(state).find(b=>b.kind==='dock'&&b.key);
  if(dock){const [c,r]=dock.key.split(':').map(Number);return {c,r};}
  const fish=world?.fishingSpots?.[0]?.position;
  if(fish)return {c:Math.floor(fish[0]-origin[0]),r:Math.floor(fish[1]-origin[1])};
  return null;
}

function anchorOf(state,world){
  const size=gridSize(world);
  const grass=grassCentroid(world);
  if(!grass)return null;
  const target=shoreTarget(state,world);
  const shore=nearestGrass(world,target?target.c:grass.c,target?target.r:0);
  if(!shore)return null;
  const dx=grass.c-shore.c,dy=grass.r-shore.r;
  let ic=0,ir=0;
  if(Math.abs(dx)>=Math.abs(dy))ic=Math.sign(dx)||1;
  else ir=Math.sign(dy)||1;
  let c=shore.c,r=shore.r;
  const dock=placedFootprints(state).find(fp=>fp.kind==='dock');
  let steps=SETBACK;
  if(dock){
    const edge=ic?(ic>0?dock.col+dock.w:dock.col):(ir>0?dock.row+dock.h:dock.row);
    const here=ic?c:r;
    const past=ic?ic*(edge-here):ir*(edge-here);
    if(past+SETBACK>steps)steps=past+SETBACK;
  }
  for(let n=0;n<steps;n++){
    const nc=c+ic,nr=r+ir;
    if(terrainAt(world,nc,nr)!==2)break;
    c=nc;r=nr;
  }
  return {col:c,row:r,inlandC:ic,inlandR:ir,columns:size.columns,rows:size.rows};
}

function clearOfWater(world,fp,setback){
  for(let r=fp.row-setback;r<fp.row+fp.h+setback;r++){
    for(let c=fp.col-setback;c<fp.col+fp.w+setback;c++){
      if(terrainAt(world,c,r)!==2)return false;
    }
  }
  return true;
}

function sampleHeight(world,x,y){
  const g=world?.grid;
  if(!g?.heights)return null;
  const origin=g.origin||[0,0];
  const gx=Math.max(0,Math.min(g.columns-.00001,x-origin[0]));
  const gy=Math.max(0,Math.min(g.rows-.00001,y-origin[1]));
  const col=Math.floor(gx),row=Math.floor(gy),u=gx-col,v=gy-row,stride=g.columns+1,h=g.heights,i=row*stride+col;
  const a=h[i],b=h[i+1],c=h[i+stride],d=h[i+stride+1];
  if(![a,b,c,d].every(n=>Number.isFinite(n)))return null;
  return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
}

function sceneryBlocks(world,state,fp){
  if(!world)return false;
  const origin=world.grid?.origin||[0,0];
  const x0=origin[0]+fp.col,y0=origin[1]+fp.row;
  const circle=(x,y,rad)=>{
    const cx=Math.max(x0,Math.min(x0+fp.w,x)),cy=Math.max(y0,Math.min(y0+fp.h,y));
    return Math.hypot(x-cx,y-cy)<rad;
  };
  if((world.trees||[]).some(t=>circle(t.position?.[0],t.position?.[1],(t.radius||.4)+.4)))return true;
  const rocks=world.rocks||world.boulders||[];
  if(rocks.some(t=>circle(t.position?.[0],t.position?.[1],(t.radius||.3)+.16)))return true;
  if((world.seeds||[]).some(s=>!(state?.pickedSeeds||[]).includes(s.id)&&circle(s.position?.[0],s.position?.[1],.2)))return true;
  if((world.fishingSpots||[]).some(s=>circle(s.position?.[0],s.position?.[1],.7)))return true;
  if(world.heroStart&&circle(world.heroStart[0],world.heroStart[1],.7))return true;
  const player=state?.player;
  if(player&&player.x>x0-.4&&player.x<x0+fp.w+.4&&player.y>y0-.4&&player.y<y0+fp.h+.4)return true;
  const cells=state?.cells||{};
  for(let r=0;r<fp.h;r++)for(let c=0;c<fp.w;c++){
    const key=`${fp.col+c}:${fp.row+r}`;
    if(cells[key]?.soil)return true;
    if((world.gardenSlots||[]).some(s=>s.key===key))return true;
  }
  if(world.grid?.heights){
    let lo=Infinity,hi=-Infinity,n=0;
    for(let r=0;r<fp.h;r++)for(let c=0;c<fp.w;c++){
      const x=x0+c+.5,y=y0+r+.5;
      for(const dx of [-.4,0,.4])for(const dy of [-.4,0,.4]){
        const z=sampleHeight(world,x+dx,y+dy);
        if(z==null)continue;
        lo=Math.min(lo,z);hi=Math.max(hi,z);n++;
      }
    }
    if(n&&hi-lo>.28)return true;
  }
  for(const b of world.blockers||[]){
    const box=b?.bounds;
    if(!box)continue;
    for(let r=0;r<fp.h;r++)for(let c=0;c<fp.w;c++){
      const x=x0+c+.5,y=y0+r+.5;
      if(x>=box[0]-.12&&x<=box[2]+.12&&y>=box[1]-.12&&y<=box[3]+.12)return true;
    }
  }
  return false;
}

function slotBlocked(world,state,fp,setback){
  if(!clearOfWater(world,fp,setback))return true;
  for(const other of placedFootprints(state)){
    if(boxGap(fp,other)<needGap(fp.kind,other.kind))return true;
  }
  return sceneryBlocks(world,state,fp);
}

function dockSite(state,world){
  const {columns,rows}=gridSize(world);
  const def=buildingById('dock');
  if(!def)return noRoom();
  const [w,h]=def.size;
  const anchor=anchorOf(state,world);
  const ic=anchor?.inlandC||0,ir=anchor?.inlandR||1;
  for(let r=0;r<=rows-h;r++)for(let c=0;c<=columns-w;c++){
    const fp={kind:'dock',col:c,row:r,w,h};
    let grass=true;
    for(let rr=0;rr<h&&grass;rr++)for(let cc=0;cc<w;cc++)if(terrainAt(world,c+cc,r+rr)!==2)grass=false;
    if(!grass)continue;
    let shore=false;
    if(ir>0){for(let cc=0;cc<w;cc++)if(terrainAt(world,c+cc,r-1)!==2)shore=true;}
    else if(ir<0){for(let cc=0;cc<w;cc++)if(terrainAt(world,c+cc,r+h)!==2)shore=true;}
    else if(ic>0){for(let rr=0;rr<h;rr++)if(terrainAt(world,c-1,r+rr)!==2)shore=true;}
    else {for(let rr=0;rr<h;rr++)if(terrainAt(world,c+w,r+rr)!==2)shore=true;}
    if(!shore)continue;
    if(slotBlocked(world,state,fp,0))continue;
    return {ok:true,key:`${c}:${r}`,rotation:FACING,kind:'dock'};
  }
  return noRoom();
}

/**
 * The next autonomous spot on the one camp row: set back from the shore, groups in order
 * (tent, homes, work, the rest), one gap past the last building in that group, same facing.
 * `ok:false` uses the reason "No room in the row yet".
 */
export function campSite(state,world,kind){
  const lane=CAMP_LANE[kind];
  if(!lane)return {ok:true,skip:true};
  if(kind==='dock')return dockSite(state,world);
  const def=buildingById(kind);
  const anchor=anchorOf(state,world);
  if(!def||!anchor)return noRoom();
  const alongC=anchor.inlandR!==0?1:0,alongR=anchor.inlandC!==0?1:0;
  for(let inland=0;inland<36;inland++){
  let baseCol=anchor.col+anchor.inlandC*inland,baseRow=anchor.row+anchor.inlandR*inland;
  if(terrainAt(world,baseCol,baseRow)!==2)continue;
  for(let n=0;n<anchor.columns+anchor.rows;n++){
    const nc=baseCol-alongC,nr=baseRow-alongR;
    if(terrainAt(world,nc,nr)!==2)break;
    baseCol=nc;baseRow=nr;
  }
  for(let n=0;n<SETBACK+2;n++){
    if(clearOfWater(world,{col:baseCol,row:baseRow,w:2,h:2},1))break;
    baseCol+=alongC;baseRow+=alongR;
  }
  const [w,h]=def.size;
  const onThisRow=fp=>{
    const cross=alongC?fp.row:fp.col,base=alongC?baseRow:baseCol;
    return Math.abs(cross-base)<Math.max(fp.h,fp.w,h);
  };
  const mates=placedFootprints(state).filter(fp=>CAMP_LANE[fp.kind]===lane&&onThisRow(fp));
  let along=GROUP_AT[lane]??0;
  if(mates.length){
    const far=Math.max(...mates.map(fp=>alongC?fp.col+fp.w:fp.row+fp.h));
    const base=alongC?baseCol:baseRow;
    along=Math.max(along,far+(lane==='sacred'?SACRED_GAP:CAMP_GAP)-base);
  }
  const limit=(alongC?anchor.columns:anchor.rows)+2;
  let placed=null;
  for(let guard=0;guard<limit;guard++){
    const col=baseCol+alongC*along,row=baseRow+alongR*along;
    const fp={kind,col,row,w,h};
    const alongEnd=alongC?col+w:row+h,alongMax=alongC?anchor.columns:anchor.rows;
    const crossPos=alongC?row:col,crossEnd=alongC?row+h:col+w,crossMax=alongC?anchor.rows:anchor.columns;
    if(crossPos<0||crossEnd>crossMax)break;
    if((alongC?col:row)<0){along+=1;continue;}
    if(alongEnd>alongMax)break;
    if(!slotBlocked(world,state,fp,1)){placed={ok:true,key:`${col}:${row}`,rotation:FACING,kind};break;}
    along+=1;
  }
  if(placed)return placed;
  }
  return noRoom();
}

function wantsNewCampBuilding(intent){
  if(!intent||isMaintenance(intent))return false;
  if(!CAMP_LANE[intent.kind])return false;
  if(intent.action==='upgrade'||intent.action==='fence'||intent.action==='expand'||intent.action==='craft'||intent.action==='cook')return false;
  if(intent.action==='paddock'&&intent.kind!=='stable')return false;
  return true;
}

function allow(state,world,intent){
  if(!wantsNewCampBuilding(intent))return pass();
  const spot=campSite(state,world,intent.kind);
  if(!spot.ok)return noRoom();
  if(intent.key){
    const rotation=Number.isInteger(intent.rotation)?intent.rotation:0;
    if(String(intent.key)!==String(spot.key)||rotation!==spot.rotation)return noRoom();
  }
  return {ok:true,reason:null,instead:null,site:{kind:intent.kind,key:spot.key,rotation:spot.rotation}};
}

/**
 * @param {object} state island save
 * @param {{who?:string,brain?:string,intent?:object,world?:object}} call
 * @returns {{ok:boolean,reason:string|null,instead:string|null,site?:{kind:string,key:string,rotation:number}}}
 */
export function checkIn(state,call={}){
  const who=call.who,brain=String(call.brain||'').toLowerCase(),intent=call.intent||{};
  const brainLane=laneOf(brain);
  const board=trackBoard(state);
  const instead=()=>laggingInstead(board,intent);

  if(isPlayed(state,who))return fail('played',instead());

  if(intent.kind&&intent.key){
    const cells=planKeys(intent),taken=occupied(state);
    if(cells&&cells.some(k=>taken.has(k)))return fail('overlap',instead());
  }

  // Farm lane: the open paddock (fence, trough, feed pile) is flock work in every stage. The first stable is too, and it takes a row slot. A second stable is refused below.
  if(brainLane==='animals'&&intent.action==='paddock'&&['fence','trough','feed_pile'].includes(intent.kind))return pass();
  if(brainLane==='animals'&&intent.action==='paddock'&&intent.kind==='stable'&&countKind(state,'stable')===0)return allow(state,call.world,intent);

  if(placingBuilding(intent)){
    const next=nextBuildingGoal(state);
    if(next&&!meetsGoal(intent.kind,next.id))return fail('goal',wrongBuildingInstead(state,intent));
    if(UNIQUE_BUILDINGS.has(intent.kind)&&countKind(state,intent.kind)>=1)return fail('unique',wrongBuildingInstead(state,intent));
  }

  const secondPaddock=intent.kind==='stable'&&countKind(state,'stable')>=1
    ||(intent.action==='paddock'&&!isMaintenance(intent)&&countKind(state,'stable')>=1&&intent.kind!=='fence'&&intent.kind!=='trough'&&intent.kind!=='feed_pile');
  if(secondPaddock)return fail('paddock',instead());

  if(isMaintenance(intent))return pass();

  const work=workLane(intent,brainLane);
  if(brainLane&&work&&work!==brainLane)return fail('lane',instead());
  if(work&&board.lagging?.id===work)return allow(state,call.world,intent);
  if(todayMatches(state,who,brainLane)&&(!work||work===brainLane))return allow(state,call.world,intent);
  return fail('lane',instead());
}

/**
 * One refusal line per friend per island hour. Toast plus the island feed.
 * `bag` is a plain object the caller keeps (`{last}`).
 */
export function speakRefusal(game,bag,who,name,result){
  if(!result||result.ok||!result.instead||!game)return false;
  const key=`${who||'friend'}:${islandHour(game.store?.state)}`;
  const mem=bag||speakRefusal.bag;
  if(mem.last===key)return false;
  mem.last=key;
  game.toast?.(result.instead,4200);
  try{noteEvent('note',result.instead,{who:name||'',id:`foreman:${key}`});}catch{/* feed is best-effort */}
  return true;
}
speakRefusal.bag={};
