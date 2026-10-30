/**
 * Garden rules — what the garden keeper (Abel) knows, as pure data and geometry.
 *
 * No three.js, no save access: everything takes `(state, world)` and returns plain objects, so the
 * runtime (garden-keeper.js), the foreman payload and the tests all read the same facts.
 *
 *  - gardenStatus(state, world): plots, clusters, the fence ring with its gaps per side, the gate,
 *    scarecrow cover, coyote/crow exposure, attack history and the upgrades the keeper understands.
 *  - deriveRequests(status, state, world): the kid-readable jobs Abel does himself
 *    (fence a side, lay the gate, put up a scarecrow, clear a stump, chop wood, lay a path…).
 *  - planNextPlots(state, world, status, shape): where the next rows go — clean rectangles by default,
 *    or a HEART / SMILEY block once the garden is fenced and big enough.
 *
 * Grid conventions: cell key `col:row`; +row is north (+y in gameplay metres), +col is east. Coyotes
 * come along the garden's row from the west and east edges (fencing.mjs); crows come from above.
 */
import {buildingById,activeBuildings,footprint,woodTotal} from './building.mjs';
import {canPlow,cellFromKey,activeStumps,activeTrees,activeRocks,inBlocker,buildSiteStatus,gameTime,dist,seedById} from './core.mjs';
import {THREAT_DAY,dayIndex,sceneryCells,gateTiles,lineShielded,edgeSpawn,gardenFocus,scarecrowCovers,enclosureMap,regionAt} from './fencing.mjs';

/** Plots a garden may reach before the keeper insists on a closed fence ring. */
export const FENCE_BEFORE_PLOTS=16;
/** One scarecrow keeps the crows off about this many plots. */
export const PLOTS_PER_SCARECROW=12;
/** Rectangles stay at most this long for their width (or the other way round). */
export const MAX_ASPECT=2;
/** Rows per block before a walkway is left between blocks. */
export const BLOCK_ROWS=4;
/** A shape block (heart, smiley) is offered once the garden is fenced and this big. */
export const SHAPE_MIN_PLOTS=16;
/** How many island days an attack keeps a side "hot". */
export const ATTACK_MEMORY_DAYS=2;

export const SIDES=['north','south','east','west'];

/**
 * Shape masks, top row first (top = north = higher row). `#` fill crop, `o` feature crop, `.` grass.
 * Pumpkins read orange-red from above, wheat and sunflowers yellow, carrots orange: the heart is all
 * pumpkin, the smiley is a wheat face with pumpkin eyes and mouth.
 */
export const SHAPES={
  rectangle:{id:'rectangle',name:'Rectangle',icon:'hoe',blurb:'Neat rows that are easy to water.',mask:null},
  heart:{id:'heart',name:'Heart',icon:'pumpkin',blurb:'A pumpkin heart you can see from the hill.',fill:'pumpkin_seed',feature:'pumpkin_seed',
    mask:['.##.##.','#######','#######','.#####.','..###..','...#...']},
  smiley:{id:'smiley',name:'Smiley',icon:'sunflower',blurb:'A wheat face with pumpkin eyes.',fill:'wheat_seed',feature:'pumpkin_seed',
    mask:['..###..','.#####.','##o#o##','#######','#o###o#','.#ooo#.','..###..']},
};
export const SHAPE_IDS=Object.keys(SHAPES);
export const shapeById=id=>SHAPES[id]||SHAPES.rectangle;

/** Mask → tiles relative to the block's south-west corner: [{dc,dr,role:'fill'|'feature'}]. Row 0 of the mask is the northern-most row. */
export function maskTiles(shape){
  const s=shapeById(shape);if(!s.mask)return [];
  const h=s.mask.length,out=[];
  s.mask.forEach((line,i)=>{for(let dc=0;dc<line.length;dc++){const ch=line[dc];if(ch==='.')continue;out.push({dc,dr:h-1-i,role:ch==='o'?'feature':'fill'});}});
  return out;
}
export function maskSize(shape){const s=shapeById(shape);return s.mask?{w:s.mask[0].length,h:s.mask.length}:null;}

export const parseKey=key=>{const [c,r]=String(key).split(':').map(Number);return {col:c,row:r};};
export const keyOf=(c,r)=>`${c}:${r}`;

/** Every soil cell plus the island's built-in garden slots: the plots the keeper looks after. */
export function gardenKeys(state,world){
  const keys=new Set();
  for(const [k,c] of Object.entries(state.cells||{}))if(c?.soil||c?.seed)keys.add(k);
  for(const s of world.gardenSlots||[])keys.add(s.key);
  return [...keys];
}
export function boundsOf(keys){
  let c0=Infinity,r0=Infinity,c1=-Infinity,r1=-Infinity;
  for(const k of keys){const {col,row}=parseKey(k);if(col<c0)c0=col;if(col>c1)c1=col;if(row<r0)r0=row;if(row>r1)r1=row;}
  if(!Number.isFinite(c0))return null;
  return {c0,r0,c1,r1,w:c1-c0+1,h:r1-r0+1};
}
/** Plots within 2 tiles of each other belong to one garden (a one-tile walkway between blocks keeps them together). */
export function clusters(keys){
  const left=new Set(keys),out=[];
  while(left.size){
    const [seed]=left;left.delete(seed);const group=[seed],queue=[seed];
    while(queue.length){
      const {col,row}=parseKey(queue.pop());
      for(const k of [...left]){const p=parseKey(k);if(Math.abs(p.col-col)<=2&&Math.abs(p.row-row)<=2){left.delete(k);group.push(k);queue.push(k);}}
    }
    out.push(group);
  }
  return out.sort((a,b)=>b.length-a.length);
}
/** The ring of tiles one step outside the bounds. Corners are tagged so the rules can treat them as posts. */
export function ringTiles(b,m=1){
  const out=[],c0=b.c0-m,c1=b.c1+m,r0=b.r0-m,r1=b.r1+m;
  for(let c=c0;c<=c1;c++){out.push({key:keyOf(c,r1),col:c,row:r1,side:'north',corner:c===c0||c===c1});out.push({key:keyOf(c,r0),col:c,row:r0,side:'south',corner:c===c0||c===c1});}
  for(let r=r0+1;r<r1;r++){out.push({key:keyOf(c0,r),col:c0,row:r,side:'west',corner:false});out.push({key:keyOf(c1,r),col:c1,row:r,side:'east',corner:false});}
  return out;
}
const fenceKind=k=>k==='fence'||k==='brick_fence'||k==='brick';
/** Complete fence pieces by cell. */
export function fenceCells(state,world){
  const map=new Map();
  for(const b of activeBuildings(state)){
    if(b.status!=='complete'||!fenceKind(b.kind))continue;
    const fp=footprint(world,b);if(!fp)continue;for(const k of fp.keys)map.set(k,b);
  }
  return map;
}
function pathCells(state,world){
  const map=new Map();
  for(const b of activeBuildings(state)){if(b.kind!=='path')continue;const fp=footprint(world,b);if(fp)for(const k of fp.keys)map.set(k,b);}
  return map;
}
/** What stands in the way of a 1×1 build on this tile, from the reducer's own site check. */
export function obstacleAt(state,world,key,minutes){
  const site=buildSiteStatus(world,state,{kind:'fence',key,rotation:0},minutes);
  if(site.ok)return null;
  const p=cellFromKey(world,key),reason=site.reason||'';
  if(/stump/i.test(reason)){const t=activeStumps(world,state).sort((a,b)=>dist(p,{x:a.position[0],y:a.position[1]})-dist(p,{x:b.position[0],y:b.position[1]}))[0];return {what:'stump',id:t?.id||null,reason};}
  if(/tree/i.test(reason)){const t=activeTrees(world,state,minutes).sort((a,b)=>dist(p,{x:a.position[0],y:a.position[1]})-dist(p,{x:b.position[0],y:b.position[1]}))[0];return {what:'tree',id:t?.id||null,reason};}
  if(/rock/i.test(reason)){const r=activeRocks(world,state).sort((a,b)=>dist(p,{x:a.position[0],y:a.position[1]})-dist(p,{x:b.position[0],y:b.position[1]}))[0];return {what:'rock',id:r?.id||null,reason};}
  if(/building/i.test(reason))return {what:'building',id:null,reason};
  if(/grass|beach|water|island/i.test(reason))return {what:'ground',id:null,reason};
  if(/garden/i.test(reason))return {what:'soil',id:null,reason};
  return {what:'other',id:null,reason};
}
/** Centre of the island's camp (or where the hero starts), used to pick the gate side. */
export function villageCentre(state,world){
  const done=activeBuildings(state).filter(b=>b.status==='complete'&&buildingById(b.kind)?.solid&&!fenceKind(b.kind)&&b.kind!=='scarecrow');
  if(!done.length)return {x:world.heroStart?.[0]??0,y:world.heroStart?.[1]??0};
  let x=0,y=0,n=0;for(const b of done){const fp=footprint(world,b);if(!fp)continue;x+=fp.center.x;y+=fp.center.y;n++;}
  return n?{x:x/n,y:y/n}:{x:world.heroStart?.[0]??0,y:world.heroStart?.[1]??0};
}

/**
 * One garden cluster, read for the keeper: its bounds, ring, gaps, gate and cover.
 * Ring tile status: fence | brick | scenery (the island's own fence or a prop stands there) | gate | gap | blocked | soil.
 */
export function clusterStatus(state,world,keys,{minutes=gameTime(state),centre=villageCentre(state,world),savedGate=null}={}){
  const b=boundsOf(keys),soil=new Set(keys),fences=fenceCells(state,world),paths=pathCells(state,world),scenery=sceneryCells(world),gates=gateTiles(world,state);
  const ring=ringTiles(b,1).map(t=>{
    let status='gap',by=null,building=null;
    if(soil.has(t.key))status='soil';
    else if(fences.has(t.key)){building=fences.get(t.key);status=building.kind==='fence'?'fence':'brick';}
    else if(gates.has(t.key)){status='gate';building=paths.get(t.key)||null;}
    else if(paths.has(t.key)){status='gate_open';building=paths.get(t.key);}
    else if(scenery.has(t.key)){status='scenery';by=scenery.get(t.key);}
    return {...t,status,by,building,integrity:building?state.farm?.integrity?.[building.id]??1:null};
  });
  // Gaps that cannot take a fence (a stump, a tree, a rock, the beach) are reported with what is in the way.
  for(const t of ring){if(t.status!=='gap')continue;const ob=obstacleAt(state,world,t.key,minutes);if(ob){t.status='blocked';t.obstacle=ob;}}
  const closed=t=>['fence','brick','scenery','gate','soil'].includes(t.status);
  const perimeter=ring.length,fenced=ring.filter(closed).length;
  // The gate: a non-corner ring tile on the side facing camp (north or south when possible — coyotes run in along the row).
  const gate=pickGate(ring,b,world,centre,savedGate);
  const gaps=ring.filter(t=>!closed(t)&&t.key!==gate?.key);
  const gapsBySide=Object.fromEntries(SIDES.map(s=>[s,gaps.filter(t=>t.side===s&&!t.corner).length]));
  const corners=gaps.filter(t=>t.corner).length;
  // Fences that ended up inside the garden when it grew: they block the walkways and should come down.
  const inner=[];
  for(const [k,f] of fences){const p=parseKey(k);if(p.col>b.c0-1&&p.col<b.c1+1&&p.row>b.r0-1&&p.row<b.r1+1&&!soil.has(k))inner.push({key:k,building:f});}
  const planted=keys.filter(k=>state.cells?.[k]?.seed).length;
  const centreCell={x:world.grid.origin[0]+(b.c0+b.c1+1)/2,y:world.grid.origin[1]+(b.r0+b.r1+1)/2};
  const uncovered=keys.filter(k=>{const p=cellFromKey(world,k);return !scarecrowCovers(world,state,p.x,p.y);});
  const scarecrows=activeBuildings(state).filter(x=>x.kind==='scarecrow'&&x.status==='complete').filter(x=>{const fp=footprint(world,x);return fp&&Math.abs(fp.center.x-centreCell.x)<=b.w/2+6&&Math.abs(fp.center.y-centreCell.y)<=b.h/2+6;}).length;
  return {keys,plots:keys.length,planted,bounds:b,centre:centreCell,shape:{w:b.w,h:b.h,aspect:Math.max(b.w,b.h)/Math.min(b.w,b.h)},ring,perimeter,fenced,fencedPct:perimeter?Math.round(fenced/perimeter*100):0,
    gate:gate?{key:gate.key,side:gate.side,status:gate.status,built:gate.status==='gate'}:null,gaps,gapsBySide,corners,inner,
    scarecrows:{count:scarecrows,covered:keys.length-uncovered.length,uncovered:uncovered.length,needed:Math.max(0,Math.ceil(uncovered.length/PLOTS_PER_SCARECROW))}};
}
function pickGate(ring,b,world,centre,savedGate){
  const candidates=ring.filter(t=>!t.corner&&['gap','gate','gate_open','fence','brick'].includes(t.status));
  if(!candidates.length)return null;
  const built=ring.find(t=>t.status==='gate'||t.status==='gate_open');if(built)return built;
  const saved=savedGate&&candidates.find(t=>t.key===savedGate);if(saved)return saved;
  // A ring with exactly one opening left: that opening is the gate (the kid or a builder meant it).
  const gaps=candidates.filter(t=>t.status==='gap');
  if(gaps.length===1&&candidates.length>1)return gaps[0];
  const d=t=>{const p=cellFromKey(world,t.key);return dist(p,centre);};
  const ns=candidates.filter(t=>t.side==='north'||t.side==='south').sort((x,y)=>d(x)-d(y));
  return (ns[0]||candidates.sort((x,y)=>d(x)-d(y))[0])||null;
}

/** Plots a coyote could reach tonight: not enclosed by fences, scenery and shut gates (fencing.mjs enclosureMap). */
export function openPlots(state,world,keys){
  const map=enclosureMap(world,state.buildings);
  return keys.filter(k=>{const p=cellFromKey(world,k);return !regionAt(map,world,p.x,p.y);});
}
/** Sides a coyote can still reach the crops from: the night rules' straight run is not blocked and some plots lie in the open. */
export function coyoteExposure(state,world,keys=gardenKeys(state,world)){
  if(!keys.length||!openPlots(state,world,keys).length)return [];
  const focus=gardenFocus(world,state),out=[];
  for(const [side,name] of [[-1,'west'],[1,'east']]){
    const from=edgeSpawn(world,focus,side);
    if(!lineShielded(world,state,from,focus))out.push(name);
  }
  return out;
}

/**
 * The whole picture for the keeper, the card and the foreman.
 * { day, threatDay, plots, planted, primary, clusters[], fencedPct, gaps[], gapsBySide, gate, scarecrows, exposure, attacks[], lastAttack, threatLevel, upgradesAvailable[], plan }
 */
export function gardenStatus(state,world,{minutes=gameTime(state)}={}){
  const day=dayIndex(minutes),keys=gardenKeys(state,world),garden=state.village?.garden||{};
  const groups=clusters(keys),centre=villageCentre(state,world);
  const list=groups.map((g,i)=>({id:i,...clusterStatus(state,world,g,{minutes,centre,savedGate:i===0?garden.gate||null:null})}));
  const primary=list[0]||null;
  const attacks=(garden.attacks||[]).slice(-10),lastAttack=attacks.at(-1)||null;
  const recentAttack=lastAttack&&day-lastAttack.day<=ATTACK_MEMORY_DAYS?lastAttack:null;
  const open=keys.length?openPlots(state,world,keys):[];
  const exposure={coyote:coyoteExposure(state,world,keys),crow:primary?primary.scarecrows.uncovered>0:false,openPlots:open.length};
  const threats=day>=THREAT_DAY||!!lastAttack;
  const openSides=primary?SIDES.filter(s=>primary.gapsBySide[s]>0):[];
  let threatLevel='none';
  if(threats&&primary){
    if(recentAttack&&(openSides.length||exposure.coyote.length))threatLevel='high';
    else if(openSides.length||exposure.coyote.length||exposure.crow)threatLevel='medium';
    else threatLevel='low';
  }else if(primary&&(openSides.length||exposure.coyote.length))threatLevel='watch';
  const inv=state.inventory||{};
  const upgradesAvailable=[];
  if(primary){
    const woodGaps=primary.ring.filter(t=>t.status==='fence');
    if((woodGaps.length||openSides.length)&&brickUpgradeAllowed(state,{recentAttack,lastAttack,attacks}))upgradesAvailable.push({id:'brick_fence',name:'Brick fence',why:(inv.concrete_brick||0)>0?'Coyotes have been here, and we have stone. A brick fence holds when wood does not.':'Coyotes have been here, and we have stone. Make bricks at the well, then the fence can be brick.'});
    if(primary.scarecrows.needed>primary.scarecrows.count||primary.scarecrows.uncovered>0)upgradesAvailable.push({id:'scarecrow',name:'Scarecrow',why:`Crows keep off a 10×10 patch around one. ${primary.scarecrows.uncovered} plot${primary.scarecrows.uncovered===1?' is':'s are'} still open sky.`});
    if(primary.gate&&!primary.gate.built)upgradesAvailable.push({id:'gate',name:'Garden gate',why:'A stone step between two fence posts: friends walk in, coyotes do not.'});
    if(primary.gate?.built&&primary.fencedPct>=100)upgradesAvailable.push({id:'path',name:'Path to the garden',why:'Stepping stones from the gate toward camp.'});
    if(!activeBuildings(state).some(b=>b.kind==='well'))upgradesAvailable.push({id:'well',name:'Water well',why:'With a well on the island, watering costs no energy.'});
  }
  const plan=currentPlan(state,primary);
  // Where the garden grows next (null until the ring is shut once it is big). Computed here so requests and the card agree.
  if(primary&&primary.fencedPct>=100&&primary.plots>=FENCE_BEFORE_PLOTS){
    const saved=garden.block&&garden.block.shape===plan.shape?garden.block:null;
    const ok=key=>canPlow(world,state,key)&&!state.cells?.[key]?.soil;
    plan.block=saved||findBlock(state,world,primary,plan.shape,ok,{minutes});
  }
  const scarecrows=primary?.scarecrows||{count:0,covered:0,uncovered:0,needed:0};
  return {day,threatDay:THREAT_DAY,plots:keys.length,planted:primary?list.reduce((n,c)=>n+c.planted,0):0,primary,clusters:list,
    footprint:primary?.bounds?{...primary.bounds,plots:primary.plots}:null,perimeter:primary?.perimeter??0,
    fencedPct:primary?.fencedPct??0,gaps:primary?.gaps||[],gapsBySide:primary?.gapsBySide||Object.fromEntries(SIDES.map(s=>[s,0])),gate:primary?.gate||null,
    scarecrows,scarecrowCoverage:scarecrows,exposure,attacks,lastAttack,recentAttack,threatLevel,upgradesAvailable,plan,
    wood:woodTotal(state),stone:inv.stone||0,bricks:inv.concrete_brick||0,wheat:inv.wheat||0};
}
/** Brick is the strong fence, and only after coyotes have already come — and only when stone is on hand to make the bricks. */
export function brickUpgradeAllowed(state,status){
  const stone=(state?.inventory?.stone||0)>0;
  const attacked=!!(status?.recentAttack||status?.lastAttack||status?.attacks?.length);
  return stone&&attacked;
}
/** The layout the kid or the keeper chose, and whether a creative shape is allowed yet. */
export function currentPlan(state,primary){
  const garden=state.village?.garden||{},shape=SHAPES[garden.shape]?garden.shape:'rectangle';
  const fenced=!!primary&&primary.fencedPct>=100,big=(primary?.plots||0)>=SHAPE_MIN_PLOTS;
  return {shape,name:shapeById(shape).name,shapesUnlocked:fenced&&big,block:garden.block||null,chosenBy:garden.shapeBy||null};
}

const sideWord={north:'north side',south:'south side',east:'east side',west:'west side'};
const title=s=>s.charAt(0).toUpperCase()+s.slice(1);
/**
 * Abel's own plan, highest priority first. He walks over and does each one himself:
 *  { id, kind:'fence'|'brick_fence'|'gate'|'unfence'|'clear'|'wood'|'scarecrow'|'path', side?, tiles[], need{}, reason, priority, rule }
 * Safety first (sides coyotes came through), then the gate and posts, then crows, then comfort.
 */
export function deriveRequests(status,state,world){
  const out=[],inv=state.inventory||{},wood=woodTotal(state),bricks=inv.concrete_brick||0,brickOk=brickUpgradeAllowed(state,status);
  const recent=status.recentAttack,hot=new Set(recent?.sides||[]);
  for(const c of status.clusters){
    if(c.plots<2)continue;
    const tag=c.id?`:${c.id}`:'';
    for(const side of SIDES){
      const tiles=c.gaps.filter(t=>t.side===side&&!t.corner&&t.status==='gap').map(t=>t.key);
      if(!tiles.length)continue;
      const brick=brickOk&&bricks>=tiles.length,kind=brick?'brick_fence':'fence';
      const need=brick?{concrete_brick:tiles.length}:{wood:2*tiles.length};
      const attacked=hot.has(side)||(recent&&recent.kind==='coyote'&&!recent.sides?.length&&(side==='east'||side==='west'));
      const reason=attacked?`Coyotes got in last night — we need a ${brick?'brick ':''}fence on the ${sideWord[side]}.`:side==='east'||side==='west'?`Coyotes run in from the ${side}. The ${sideWord[side]} needs ${tiles.length} fence piece${tiles.length===1?'':'s'}.`:`The ${sideWord[side]} of the garden is open. ${tiles.length} fence piece${tiles.length===1?'':'s'} would close it.`;
      out.push({id:`fence${tag}:${side}`,kind,side,tiles,need,reason,rule:'fence_ring',priority:90+(attacked?20:0)+(side==='east'||side==='west'?5:0)+(c.id===0?0:-15),cluster:c.id});
    }
    const blocked=c.gaps.filter(t=>t.status==='blocked'&&!t.corner&&t.obstacle&&['stump','tree','rock'].includes(t.obstacle.what));
    for(const t of blocked){
      const ob=t.obstacle,word={stump:'A stump',tree:'A tree',rock:'A rock'}[ob.what];
      out.push({id:`clear${tag}:${t.key}`,kind:'clear',side:t.side,tiles:[t.key],obstacle:ob,need:{},reason:`${word} is in the way of the fence on the ${sideWord[t.side]}. ${ob.what==='stump'?'Abel will dig it out.':ob.what==='tree'?'Abel will cut it down.':'Abel will break it up.'}`,rule:'clear_perimeter',priority:70+(hot.has(t.side)?15:0),cluster:c.id});
    }
    if(c.inner.length)out.push({id:`unfence${tag}`,kind:'unfence',tiles:c.inner.map(x=>x.key),need:{},reason:'The garden grew past the old fence. Those inner pieces block the walkway — let’s take them down and use them on the outside.',rule:'move_fence',priority:85,cluster:c.id});
    const sidesOpen=SIDES.some(s=>c.gapsBySide[s]>0);
    if(c.gate&&!c.gate.built&&c.gate.status!=='gate_open'&&!sidesOpen){
      out.push({id:`gate${tag}`,kind:'gate',side:c.gate.side,tiles:[c.gate.key],need:{stone:1},reason:'One stone step between the posts makes a gate: we walk in, the coyotes stay out.',rule:'gate',priority:60+(recent?15:0),cluster:c.id});
    }
    const corners=c.gaps.filter(t=>t.corner&&t.status==='gap').map(t=>t.key);
    if(corners.length&&!sidesOpen){
      const brick=brickOk&&bricks>=corners.length,g=c.gate?parseKey(c.gate.key):null;
      // A corner that is also one of the gate's posts goes up before the gate stone.
      const gatePost=!!g&&corners.some(k=>{const p=parseKey(k);return Math.abs(p.col-g.col)+Math.abs(p.row-g.row)===1;});
      out.push({id:`posts${tag}`,kind:brick?'brick_fence':'fence',side:'corner',tiles:corners,need:brick?{concrete_brick:corners.length}:{wood:2*corners.length},reason:gatePost?`${corners.length===1?'A corner post':'Corner posts'} beside the gate would hold it.`:`${corners.length} corner post${corners.length===1?'':'s'} would finish the ring.`,rule:'fence_ring',priority:gatePost?68:50,cluster:c.id});
    }
    if(c.plots>=4&&c.scarecrows.uncovered>0&&c.scarecrows.count<c.scarecrows.needed+1){
      const spot=scarecrowSpot(state,world,c);
      if(spot)out.push({id:`scarecrow${tag}`,kind:'scarecrow',tiles:[spot],need:{wood:4,wheat:2},reason:recent?.kind==='crow'?'Crows ate from the garden at dawn — a scarecrow would keep them off.':`${c.scarecrows.uncovered} plot${c.scarecrows.uncovered===1?' has':'s have'} no scarecrow watching. One keeps crows off a 10×10 patch.`,rule:'scarecrow',priority:65+(recent?.kind==='crow'?20:0),cluster:c.id});
    }
    if(c.gate?.built&&c.fencedPct>=100&&(inv.stone||0)>=2){
      const tiles=pathFromGate(state,world,c);
      if(tiles.length)out.push({id:`path${tag}`,kind:'path',tiles,need:{stone:tiles.length},reason:'Stepping stones from the gate toward camp so nobody tramples the rows.',rule:'path',priority:30,cluster:c.id});
    }
    // Room for the next block: trees, stumps or rocks on the patch Abel picked.
    if(c.id===0&&c.fencedPct>=100&&c.plots>=FENCE_BEFORE_PLOTS){
      const block=status.plan?.block;
      for(const key of block?.clear||[]){
        const ob=obstacleAt(state,world,key);if(!ob||!['stump','tree','rock'].includes(ob.what))continue;
        const word={stump:'a stump',tree:'a tree',rock:'a rock'}[ob.what];
        out.push({id:`room:${key}`,kind:'clear',tiles:[key],obstacle:ob,need:{},reason:`Abel wants the next ${shapeById(block.shape).name.toLowerCase()} patch here, but ${word} is in the way.`,rule:'room_to_grow',priority:25,cluster:c.id});
      }
    }
  }
  // Not enough wood for the fences asked for: one ask to chop first.
  const woodNeed=out.filter(r=>r.kind==='fence').reduce((n,r)=>n+(r.need.wood||0),0);
  if(woodNeed>wood){
    const top=out.filter(r=>r.kind==='fence').sort((a,b)=>b.priority-a.priority)[0];
    out.push({id:'wood',kind:'wood',tiles:[],need:{wood:woodNeed-wood},reason:`The fence needs ${woodNeed} wood and we have ${wood}. ${Math.ceil((woodNeed-wood)/3)} tree${Math.ceil((woodNeed-wood)/3)===1?'':'s'} would do it.`,rule:'materials',priority:(top?.priority||80)-2});
  }
  return out.sort((a,b)=>b.priority-a.priority);
}
/** A non-soil tile inside or just outside the ring where a scarecrow covers the most open plots. */
export function scarecrowSpot(state,world,c,minutes=gameTime(state)){
  const b=c.bounds,soil=new Set(c.keys),best={key:null,score:0};
  const uncovered=c.keys.filter(k=>{const p=cellFromKey(world,k);return !scarecrowCovers(world,state,p.x,p.y);});
  for(let r=b.r0-2;r<=b.r1+2;r++)for(let col=b.c0-2;col<=b.c1+2;col++){
    const key=keyOf(col,r);if(soil.has(key))continue;
    const onRing=(r===b.r0-1||r===b.r1+1||col===b.c0-1||col===b.c1+1);if(onRing)continue; // the ring is for the fence
    const p=cellFromKey(world,key),score=uncovered.filter(k=>{const q=cellFromKey(world,k);return Math.abs(q.x-p.x)<=5&&Math.abs(q.y-p.y)<=5;}).length;
    if(score<=best.score)continue;
    if(!buildSiteStatus(world,state,{kind:'scarecrow',key,rotation:0},minutes).ok)continue;
    best.key=key;best.score=score;
  }
  return best.key;
}
/** Two path tiles leading away from the gate, toward camp. */
export function pathFromGate(state,world,c,minutes=gameTime(state)){
  if(!c.gate)return [];
  const g=parseKey(c.gate.key),dir={north:[0,1],south:[0,-1],east:[1,0],west:[-1,0]}[c.gate.side],out=[];
  for(let i=1;i<=2;i++){
    const key=keyOf(g.col+dir[0]*i,g.row+dir[1]*i);
    if((state.buildings||[]).some(b=>b.status!=='cancelled'&&b.key===key))break;
    if(!buildSiteStatus(world,state,{kind:'path',key,rotation:0},minutes).ok)break;
    out.push(key);
  }
  return out;
}

/**
 * Where the next plots go. Returns { blocked:string|null, tiles:[{key,role,seed}], block:{col,row,w,h,shape}|null }.
 *  - under FENCE_BEFORE_PLOTS plots: grow the rectangle a full row or column at a time (aspect ≤ 2:1);
 *  - past that, a closed ring is required first (Abel finishes the fence himself);
 *  - then new blocks start one tile away (a walkway) — a rectangle block, or the chosen shape's mask.
 */
export function planNextPlots(state,world,status,shape=currentPlan(state,status?.primary).shape,minutes=gameTime(state)){
  const c=status?.primary;
  if(!c)return {blocked:null,tiles:[],block:null};
  const ok=key=>canPlow(world,state,key)&&!state.cells?.[key]?.soil;
  const b=c.bounds;
  if(c.plots<FENCE_BEFORE_PLOTS||(b.w*b.h<FENCE_BEFORE_PLOTS&&c.fencedPct<100)){
    const lines=[];
    // Candidate full rows/columns hugging the bounds; keep the rectangle squat.
    if((b.h+1)/b.w<=MAX_ASPECT){lines.push({tiles:range(b.c0,b.c1).map(col=>keyOf(col,b.r1+1))});lines.push({tiles:range(b.c0,b.c1).map(col=>keyOf(col,b.r0-1))});}
    if((b.w+1)/b.h<=MAX_ASPECT){lines.push({tiles:range(b.r0,b.r1).map(row=>keyOf(b.c1+1,row))});lines.push({tiles:range(b.r0,b.r1).map(row=>keyOf(b.c0-1,row))});}
    const fit=lines.find(l=>l.tiles.every(ok));
    if(fit)return {blocked:null,tiles:fit.tiles.map(key=>({key,role:'fill',seed:null})),block:null};
    // A partial row is better than nothing while the garden is small.
    const partial=lines.map(l=>l.tiles.filter(ok)).sort((x,y)=>y.length-x.length)[0];
    if(partial?.length)return {blocked:null,tiles:partial.map(key=>({key,role:'fill',seed:null})),block:null};
  }
  if(c.fencedPct<100)return {blocked:'The garden is big enough now — Abel wants the fence finished before it grows any more.',tiles:[],block:null};
  const saved=state.village?.garden?.block;
  if(saved&&saved.shape===shape){
    const tiles=blockTiles(saved).filter(t=>ok(t.key));
    if(tiles.length)return {blocked:null,tiles,block:saved};
  }
  const block=(status.plan?.block?.shape===shape?status.plan.block:null)||findBlock(state,world,c,shape,ok,{minutes});
  if(!block)return {blocked:'There is no clear grass beside the garden for the next block. Clearing trees, stumps or rocks nearby would help.',tiles:[],block:null};
  const tiles=blockTiles(block).filter(t=>ok(t.key));
  return {blocked:block.clear?.length&&!tiles.length?'Abel has picked the next patch, but trees or rocks are in the way.':null,tiles,block};
}
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
/** Tiles of a block with their crop roles (mask shapes) or plain fill (rectangles). */
export function blockTiles(block){
  const s=shapeById(block.shape);
  if(s.mask){return maskTiles(block.shape).map(t=>({key:keyOf(block.col+t.dc,block.row+t.dr),role:t.role,seed:t.role==='feature'?s.feature:s.fill}));}
  const out=[];for(let r=0;r<block.h;r++)for(let col=0;col<block.w;col++)out.push({key:keyOf(block.col+col,block.row+r),role:'fill',seed:null});
  return out;
}
/** How far from the garden the next block may sit (walkway tiles between). */
export const BLOCK_REACH=8;
/** Trees, stumps or rocks Abel may clear to make room for a block. */
export const BLOCK_CLEARABLE=3;
/**
 * The nearest spot beside the garden (one walkway tile away, up to BLOCK_REACH) where every tile of the block is plowable.
 * With `allowClearing`, a block that only needs a few trees/stumps/rocks cleared is returned with `block.clear=[keys]`.
 */
export function findBlock(state,world,c,shape,ok,{allowClearing=true,minutes=gameTime(state)}={}){
  const b=c.bounds,size=maskSize(shape)||{w:Math.min(Math.max(b.w,2),BLOCK_ROWS),h:Math.min(Math.max(b.h,2),BLOCK_ROWS)};
  const centre={x:(b.c0+b.c1)/2,y:(b.r0+b.r1)/2};
  const cols=world.grid.columns,rows=world.grid.rows;
  // A big picture is worth a few more trees coming down (the woodcutters want the wood anyway).
  const maxClear=shape==='rectangle'?BLOCK_CLEARABLE:Math.max(BLOCK_CLEARABLE,Math.ceil(size.w*size.h/6));
  const okCache=new Map(),obCache=new Map();
  const free=key=>{if(!okCache.has(key))okCache.set(key,!!ok(key));return okCache.get(key);};
  const obstacle=key=>{if(!obCache.has(key))obCache.set(key,obstacleAt(state,world,key,minutes));return obCache.get(key);};
  let best=null;
  const consider=(block,gap,k,side)=>{
    if(block.col<1||block.row<1||block.col+block.w>cols-1||block.row+block.h>rows-1)return;
    const tiles=blockTiles(block),bad=tiles.filter(t=>!free(t.key)).map(t=>t.key);
    let clear=[];
    if(bad.length){
      if(!allowClearing||bad.length>maxClear)return;
      for(const key of bad){
        if(state.cells?.[key]?.soil)return;
        const o=obstacle(key);
        if(!o||!['tree','stump','rock'].includes(o.what))return;
        clear.push(key);
      }
    }
    const u={c0:Math.min(b.c0,block.col),c1:Math.max(b.c1,block.col+block.w-1),r0:Math.min(b.r0,block.row),r1:Math.max(b.r1,block.row+block.h-1)};
    // The walkway between the blocks does not count toward how long the garden looks.
    const uw=u.c1-u.c0+1-(side==='east'||side==='west'?gap:0),uh=u.r1-u.r0+1-(side==='north'||side==='south'?gap:0);
    const aspect=Math.max(uw,uh)/Math.min(uw,uh);
    const d=Math.hypot(block.col+block.w/2-.5-centre.x,block.row+block.h/2-.5-centre.y);
    // Nearest first; clearing costs a lot, a lopsided rectangle garden costs more, lining up with the old garden is free.
    const score=d+gap*.5+(shape==='rectangle'&&aspect>MAX_ASPECT?20:0)+Math.abs(k)*.25+clear.length*4;
    if(!best||score<best.score)best={block:clear.length?{...block,clear}:block,score};
  };
  for(let gap=1;gap<=BLOCK_REACH;gap++){
    for(const side of ['east','south','west','north']){
      for(let k=-size.w;k<=b.w;k++){
        let col,row;
        if(side==='east'){col=b.c1+1+gap;row=b.r0+k;}
        else if(side==='west'){col=b.c0-gap-size.w;row=b.r0+k;}
        else if(side==='north'){col=b.c0+k;row=b.r1+1+gap;}
        else {col=b.c0+k;row=b.r0-gap-size.h;}
        if(side==='east'||side==='west'){if(k<-size.h||k>b.h)continue;}
        consider({col,row,w:size.w,h:size.h,shape},gap,k,side);
      }
    }
    if(best&&!best.block.clear)break; // something clean sits this close: take it
  }
  return best?.block||null;
}
/** The seed Eve should put in this cell to make the shape read from above, or null for "whatever is plentiful". */
export function seedForCell(state,key,available){
  const block=state.village?.garden?.block;if(!block)return null;
  const tile=blockTiles(block).find(t=>t.key===key);if(!tile?.seed)return null;
  if(available&&!available.includes(tile.seed)){
    // Same colour family if we can: orange (pumpkin/carrot), yellow (wheat/sunflower).
    const family={pumpkin_seed:['carrot_seed'],carrot_seed:['pumpkin_seed'],wheat_seed:['sunflower_seed'],sunflower_seed:['wheat_seed']}[tile.seed]||[];
    return family.find(s=>available.includes(s))||null;
  }
  return tile.seed;
}
/** A cell is "outside the fence" when the ring is closed and the cell is not inside the primary cluster's bounds. */
export function outsideFence(status,key){
  const c=status?.primary;if(!c||c.fencedPct<100)return false;
  const p=parseKey(key),b=c.bounds;return p.col<b.c0||p.col>b.c1||p.row<b.r0||p.row>b.r1;
}

/** Abel's own words for a job he will do himself, in his soft-spoken voice (characters.mjs). */
export function keeperLine(request){
  switch(request?.kind){
    case 'fence':case 'brick_fence':return request.side==='corner'?`A few corner posts and the ring is done. I'll put them up.`:`I'll put it up. ${request.reason.replace(/^Coyotes got in last night — /,'Coyotes got in last night. ')}`;
    case 'gate':return `One stone step between the posts, and we have a gate. I'll lay it.`;
    case 'scarecrow':return `The crows are bold this week. I'll put a scarecrow by the rows.`;
    case 'clear':return `Something is in the way of the fence. I'll clear it.`;
    case 'wood':return `We are short of wood for the fence. I'll cut a tree, or wait until the store has some.`;
    case 'unfence':return `The old fence is inside the garden now. I'll move it out.`;
    case 'path':return `Stepping stones from the gate would save the rows. I'll lay them.`;
    default:return null;
  }
}
/** The one-line rule list the card and the foreman show. */
export const RULES=[
  {id:'fence_ring',text:`Fence all the way round before the garden grows past ${FENCE_BEFORE_PLOTS} plots.`},
  {id:'coyote_sides',text:'Coyotes come in along the rows from the east and west — close those sides first.'},
  {id:'gate',text:'A stone step between two fence posts is the gate: friends in, coyotes out.'},
  {id:'brick',text:'The fence turns to brick only after coyotes have attacked, and only when we have stone to make the bricks.'},
  {id:'scarecrow',text:`One scarecrow for every ${PLOTS_PER_SCARECROW} plots keeps the crows off.`},
  {id:'move_fence',text:'When the garden grows past the fence, the inner pieces come down and go back up outside.'},
  {id:'shapes',text:`Clean rectangles by default; once fenced and ${SHAPE_MIN_PLOTS} plots big, the next block can be a heart or a smiley.`},
  {id:'delegate',text:'Abel builds the garden fences and scarecrows himself. He still never builds houses.'},
];
