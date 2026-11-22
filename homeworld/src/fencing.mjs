// Fences, pastures, and the night rules that use them.
// Pure save logic (no three.js). Building meshes are registered separately via registerFarmAssets.
import {MORNING,DAYLIGHT_MINUTES} from './island-clock.mjs';
import {footprint, pointInBounds, layerCount, subtractLayer, buildingById} from './building.mjs';
import {LIVESTOCK,DOG_CAPACITY} from './animals.mjs';

const DAY=1440;
export const THREAT_DAY=7;
const HERD_MINUTES=90;
const WOOD_LOSS=.4,BRICK_LOSS=.1,BREAK_AT=.25;
const SCARECROW_HALF=5;
const STABLE_MARGIN=.8;

export function dayIndex(min){return Math.floor((min-MORNING)/DAY);}
export function dawnMinute(day){return MORNING+day*DAY;}
export function nightMinute(day){return MORNING+day*DAY+DAYLIGHT_MINUTES;}
export function cellKey(world,x,y){
  const c=Math.floor(x-world.grid.origin[0]),r=Math.floor(y-world.grid.origin[1]);
  return `${c}:${r}`;
}
function cellCenter(world,key){
  const [c,r]=key.split(':').map(Number);
  return {x:world.grid.origin[0]+c+.5,y:world.grid.origin[1]+r+.5};
}
function terrainAt(world,x,y){
  const c=Math.floor(x-world.grid.origin[0]),r=Math.floor(y-world.grid.origin[1]);
  if(c<0||r<0||c>=world.grid.columns||r>=world.grid.rows)return 0;
  return world.grid.mask[r*world.grid.columns+c];
}
const brickKind=k=>k==='brick_fence'||k==='brick';
const fenceKind=k=>k==='fence'||brickKind(k);
const done=b=>b&&b.status==='complete';
function note(farm,text){farm.pendingToasts=[...(farm.pendingToasts||[]),text];}
function hashRoll(id,day){
  let h=2166136261;const s=`${id}:${day}:sheep`;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
  return (h>>>0)%2===0;
}

/** The island's own fences and borders in the scenery (DEMO_HW_GardenLeftFence…): they keep coyotes out like a built fence. */
export const isSceneryFence=id=>/fence|border|wall|hedge/i.test(String(id||''));
const sceneryCache=new WeakMap();
function polygonHit(polygon,x,y){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [ax,ay]=polygon[j],[bx,by]=polygon[i];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}
/**
 * Scenery blockers (fences, props, cliffs) rasterised to grid cells: Map key → blocker id. A cell counts when the
 * blocker's box overlaps it (polygon blockers are sampled). Cached per world. Used so a wheelbarrow or the demo
 * fence closes a gap the way the navigation already treats it: nothing walks through.
 */
export function sceneryCells(world){
  if(!world?.grid)return new Map();
  let map=sceneryCache.get(world);if(map)return map;
  map=new Map();
  const origin=world.grid.origin,cols=world.grid.columns,rows=world.grid.rows,eps=.02;
  for(const b of world.blockers||[]){
    const [x0,y0,x1,y1]=b.bounds;
    const c0=Math.max(0,Math.floor(x0-origin[0])),c1=Math.min(cols-1,Math.floor(x1-origin[0]-eps)),r0=Math.max(0,Math.floor(y0-origin[1])),r1=Math.min(rows-1,Math.floor(y1-origin[1]-eps));
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
      const key=`${c}:${r}`;if(map.has(key))continue;
      if(b.polygon){
        const bx=origin[0]+c,by=origin[1]+r;let hit=false;
        for(let i=0;i<3&&!hit;i++)for(let j=0;j<3;j++){if(polygonHit(b.polygon,bx+.1+i*.4,by+.1+j*.4)){hit=true;break;}}
        if(!hit)continue;
      }
      map.set(key,b.id);
    }
  }
  sceneryCache.set(world,map);
  return map;
}
/**
 * Garden gates: a finished stone path tile with a fence, scenery or another wall on two opposite sides. Friends
 * walk over it; at night it counts as closed, so the pen stays a pen. Returns Set of cell keys.
 */
export function gateTiles(world,state){
  const out=new Set(),buildings=state?.buildings||[],scenery=sceneryCells(world),walls=new Set(scenery.keys());
  for(const b of buildings){if(!done(b)||!fenceKind(b.kind))continue;const fp=footprint(world,b);if(fp)for(const k of fp.keys)walls.add(k);}
  for(const b of buildings){
    if(!done(b)||b.kind!=='path')continue;
    const fp=footprint(world,b);if(!fp)continue;
    const [c,r]=fp.keys[0].split(':').map(Number);
    const ns=walls.has(`${c}:${r+1}`)&&walls.has(`${c}:${r-1}`),ew=walls.has(`${c+1}:${r}`)&&walls.has(`${c-1}:${r}`);
    if(ns||ew)out.add(fp.keys[0]);
  }
  return out;
}
/** 4-connected flood from the map edge. Fence cells, scenery and shut gates are walls. Region 0 is the open island. */
export function enclosureMap(world,buildings){
  const cols=world.grid.columns,rows=world.grid.rows,wall=new Uint8Array(cols*rows);
  const mark=key=>{const [c,r]=key.split(':').map(Number);if(c>=0&&r>=0&&c<cols&&r<rows)wall[r*cols+c]=1;};
  for(const key of sceneryCells(world).keys())mark(key);
  for(const key of gateTiles(world,{buildings}))mark(key);
  for(const b of buildings||[]){
    if(!done(b)||!fenceKind(b.kind))continue;
    const fp=footprint(world,b);if(!fp)continue;
    for(const key of fp.keys)mark(key);
  }
  const seen=new Uint8Array(cols*rows),stack=[];
  const push=(c,r)=>{
    if(c<0||r<0||c>=cols||r>=rows)return;
    const i=r*cols+c;if(seen[i]||wall[i])return;
    seen[i]=1;stack.push(i);
  };
  for(let c=0;c<cols;c++){push(c,0);push(c,rows-1);}
  for(let r=0;r<rows;r++){push(0,r);push(cols-1,r);}
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(stack.length){
    const i=stack.pop(),c=i%cols,r=(i-c)/cols;
    for(const [dc,dr] of dirs)push(c+dc,r+dr);
  }
  const region=new Map(),rid=new Int32Array(cols*rows);
  let nextId=1;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const i=r*cols+c;
    if(seen[i]||wall[i]||rid[i])continue;
    const id=nextId++,q=[i];rid[i]=id;region.set(`${c}:${r}`,id);
    while(q.length){
      const j=q.pop(),cc=j%cols,rr=(j-cc)/cols;
      for(const [dc,dr] of dirs){
        const nc=cc+dc,nr=rr+dr;
        if(nc<0||nr<0||nc>=cols||nr>=rows)continue;
        const k=nr*cols+nc;
        if(seen[k]||wall[k]||rid[k])continue;
        rid[k]=id;region.set(`${nc}:${nr}`,id);q.push(k);
      }
    }
  }
  return {region,wall,cols,rows};
}
export function regionAt(map,world,x,y){return map?.region.get(cellKey(world,x,y))||0;}

function stables(state){return (state.buildings||[]).filter(b=>done(b)&&b.kind==='stable');}
function scarecrows(state){return (state.buildings||[]).filter(b=>done(b)&&b.kind==='scarecrow');}
export function nearStable(world,state,x,y){
  for(const b of stables(state)){
    const fp=footprint(world,b);if(!fp)continue;
    const [x0,y0,x1,y1]=fp.bounds;
    if(x>=x0-STABLE_MARGIN&&x<=x1+STABLE_MARGIN&&y>=y0-STABLE_MARGIN&&y<=y1+STABLE_MARGIN)return fp.center;
  }
  return null;
}
function stableInRegion(world,state,map,id){
  if(!id)return false;
  for(const b of stables(state)){
    const fp=footprint(world,b);if(!fp)continue;
    if(fp.keys.some(k=>(map.region.get(k)||0)===id))return true;
  }
  return false;
}
export function sheepSafe(world,state,animal,map=enclosureMap(world,state.buildings)){
  if(nearStable(world,state,animal.x,animal.y))return true;
  const id=regionAt(map,world,animal.x,animal.y);
  return stableInRegion(world,state,map,id);
}
export function scarecrowCovers(world,state,x,y){
  for(const b of scarecrows(state)){
    const fp=footprint(world,b);if(!fp)continue;
    if(Math.abs(x-fp.center.x)<=SCARECROW_HALF&&Math.abs(y-fp.center.y)<=SCARECROW_HALF)return true;
  }
  return false;
}
export function gardenFocus(world,state){
  const seeded=Object.keys(state.cells||{}).filter(k=>state.cells[k]?.seed);
  if(!seeded.length)return {x:state.player?.x||0,y:state.player?.y||0};
  let x=0,y=0;
  for(const key of seeded){const p=cellCenter(world,key);x+=p.x;y+=p.y;}
  return {x:x/seeded.length,y:y/seeded.length};
}
export function edgeSpawn(world,toward,side){
  const cols=world.grid.columns,rows=world.grid.rows,mask=world.grid.mask,origin=world.grid.origin;
  const row=Math.max(1,Math.min(rows-2,Math.floor(toward.y-origin[1])));
  const col=Math.floor(toward.x-origin[0]);
  const scan=side<0?(()=>{for(let c=1;c<col;c++)if(mask[row*cols+c]===2)return c;return null;})():(()=>{for(let c=cols-2;c>col;c--)if(mask[row*cols+c]===2)return c;return null;})();
  if(scan==null)return {x:toward.x+side*14,y:toward.y};
  return {x:origin[0]+scan+.5,y:origin[1]+row+.5};
}
export function threatTarget(world,state){return gardenFocus(world,state);}

/**
 * Everything on the straight run from the island edge to the crops that stops a coyote, in order:
 * built fences and shut gates (`{building}`) and the scenery's own fences (`{scenery:id}`, never damaged).
 */
function barriersAlong(world,buildings,from,to){
  const byKey=new Map(),gates=gateTiles(world,{buildings}),scenery=sceneryCells(world);
  for(const b of buildings||[]){
    if(!done(b)||!(fenceKind(b.kind)||(b.kind==='path'&&gates.has(b.key))))continue;
    const fp=footprint(world,b);if(!fp)continue;
    for(const key of fp.keys)if(!byKey.has(key))byKey.set(key,b);
  }
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)*2));
  const hit=[],seen=new Set();
  for(let i=0;i<=steps;i++){
    const t=i/steps,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t,key=cellKey(world,x,y),b=byKey.get(key);
    if(b&&!seen.has(b.id)){seen.add(b.id);hit.push({building:b});continue;}
    const id=scenery.get(key);
    if(id&&isSceneryFence(id)&&!seen.has(id)){seen.add(id);hit.push({scenery:id});}
  }
  return hit;
}
function fencesAlong(world,buildings,from,to){return barriersAlong(world,buildings,from,to).filter(h=>h.building).map(h=>h.building);}
/** True when something (a fence, a shut gate, the scenery's fence) stands between `from` and `to`. */
export function lineShielded(world,state,from,to){return barriersAlong(world,state.buildings,from,to).length>0;}
function eatCrop(cell,minutes){
  if(!cell?.seed||cell.hold)return false;
  delete cell.seed;delete cell.plantedAt;delete cell.wateredAt;delete cell.watered;delete cell.grown;
  cell.soil=cell.soil||'tilled';
  if(Number.isFinite(minutes))cell.emptySince=minutes;
  return true;
}
function seededCells(state){return Object.entries(state.cells||{}).filter(([,c])=>c?.seed);}
/** Kid-readable amount, such as "2 carrots" or "the wheat". Only crops this night actually ate. */
function cropPhrase(seed,n){
  const id=String(seed||'').replace(/_seed$/,'').replace(/_acorn$/,'').replace(/_samara$/,'');
  const one={carrot:'a carrot',pumpkin:'a pumpkin',sunflower:'a sunflower',wheat:'the wheat',pine:'a pine',oak:'an oak',maple:'a maple',apple:'an apple',coconut:'a coconut'};
  const many={carrot:'carrots',pumpkin:'pumpkins',sunflower:'sunflowers',wheat:'wheat',pine:'pines',oak:'oaks',maple:'maples',apple:'apples',coconut:'coconuts'};
  if(n<=1)return one[id]||`a ${id.replace(/_/g,' ')}`;
  if(id==='wheat')return `${n} wheat`;
  return `${n} ${many[id]||id.replace(/_/g,' ')}`;
}
function eatenLines(who,counts){
  const lines=[];
  for(const [seed,n] of counts)lines.push(who==='coyote'?`A coyote ate ${cropPhrase(seed,n)}`:`Crows ate ${cropPhrase(seed,n)}`);
  return lines;
}
function rememberMorning(farm,day){
  const prior=farm.nightLinesDay===day-1?(farm.nightLines||[]):[];
  const lines=[...prior,...(farm.dawnLines||[])];
  farm.morning={day,lines:lines.length?lines:['Quiet night.'],dismissed:false};
  farm.nightLines=[];farm.dawnLines=[];delete farm.nightLinesDay;
}

export function herdPlan(world,state,minutes,force=false,onlyDogId=null,skipIds=null){
  const day=dayIndex(minutes),start=nightMinute(day);
  if(!force&&(minutes<start-HERD_MINUTES||minutes>=start))return [];
  let dogs=(state.animals||[]).filter(a=>DOG_CAPACITY[a.kind]);
  if(onlyDogId)dogs=dogs.filter(a=>a.id===onlyDogId);
  if(!dogs.length||!stables(state).length)return [];
  const map=enclosureMap(world,state.buildings);
  const loose=(state.animals||[]).filter(a=>LIVESTOCK.has(a.kind)&&!nearStable(world,state,a.x,a.y)&&!stableInRegion(world,state,map,regionAt(map,world,a.x,a.y)));
  if(!loose.length)return [];
  const used=new Set(),plan=[];
  const ordered=[...dogs].sort((a,b)=>(DOG_CAPACITY[b.kind]||0)-(DOG_CAPACITY[a.kind]||0));
  for(const dog of ordered){
    let left=DOG_CAPACITY[dog.kind]||0;
    const picks=loose.filter(a=>!used.has(a.id)&&!(skipIds&&skipIds.has(a.id))).sort((a,b)=>Math.hypot(a.x-dog.x,a.y-dog.y)-Math.hypot(b.x-dog.x,b.y-dog.y));
    for(const animal of picks){
      if(left<=0)break;
      const home=nearStable(world,state,animal.x,animal.y);
      let best=home,bestD=Infinity;
      if(!best){
        for(const b of stables(state)){
          const fp=footprint(world,b);if(!fp)continue;
          const d=Math.hypot(fp.center.x-animal.x,fp.center.y-animal.y);
          if(d<bestD){bestD=d;best=fp.center;}
        }
      }
      if(!best)continue;
      used.add(animal.id);left--;
      plan.push({dogId:dog.id,animalId:animal.id,x:best.x,y:best.y});
    }
  }
  return plan;
}

function withFarm(state){
  const next=structuredClone(state);
  next.farm={integrity:{},pendingToasts:[],...(next.farm||{})};
  next.animals=next.animals||[];
  next.buildings=next.buildings||[];
  next.cells=next.cells||{};
  return next;
}
function snapHerds(state,world){
  const minutes=state.clock?.minutes??0;
  const plan=herdPlan(world,state,minutes,true);
  if(!plan.length)return state;
  const next=withFarm(state);
  for(const job of plan){
    const animal=next.animals.find(a=>a.id===job.animalId);
    if(animal){animal.x=job.x;animal.y=job.y;}
  }
  return next;
}

function nearShore(world,x,y){
  const origin=world.grid.origin,cols=world.grid.columns,rows=world.grid.rows,mask=world.grid.mask;
  const c=Math.floor(x-origin[0]),r=Math.floor(y-origin[1]);
  for(let dr=-3;dr<=3;dr++)for(let dc=-3;dc<=3;dc++){
    const rr=r+dr,cc=c+dc;
    if(rr<0||cc<0||rr>=rows||cc>=cols||mask[rr*cols+cc]===0)return true;
  }
  return false;
}
function isAmbientWildlife(animal){
  return !!animal&&(animal.kind==='rabbit'||animal.kind==='squirrel')&&(animal.wild||String(animal.id||'').startsWith('ambient-'));
}
/** Where the player is looking, or the garden if they are not standing on grass. */
function wildlifeAnchor(world,state){
  const player=state.player;
  if(player&&terrainAt(world,player.x,player.y)===2)return {x:player.x,y:player.y};
  const slots=world.gardenSlots||[];
  if(slots.length){
    let x=0,y=0;
    for(const slot of slots){x+=world.grid.origin[0]+slot.col+.5;y+=world.grid.origin[1]+slot.row+.5;}
    return {x:x/slots.length,y:y/slots.length};
  }
  return gardenFocus(world,state);
}
/** Open grass a few meters from the anchor, off the beach and off buildings. */
function grassBeside(world,state,anchor,n){
  const cols=world.grid.columns,rows=world.grid.rows,mask=world.grid.mask,origin=world.grid.origin;
  const slots=new Set((world.gardenSlots||[]).map(s=>s.key));
  const bounds=[];
  for(const b of state.buildings||[]){
    if(b.status==='cancelled')continue;
    const fp=footprint(world,b);
    if(fp?.bounds)bounds.push(fp.bounds);
  }
  const ac=Math.floor(anchor.x-origin[0]),ar=Math.floor(anchor.y-origin[1]),spots=[];
  for(let r=ar-12;r<=ar+12;r++){
    for(let c=ac-12;c<=ac+12;c++){
      if(c<1||r<1||c>=cols-1||r>=rows-1||mask[r*cols+c]!==2||slots.has(`${c}:${r}`))continue;
      let shore=false;
      for(let dr=-3;dr<=3&&!shore;dr++)for(let dc=-3;dc<=3;dc++){
        const rr=r+dr,cc=c+dc;
        if(rr<0||cc<0||rr>=rows||cc>=cols||mask[rr*cols+cc]===0)shore=true;
      }
      if(shore)continue;
      const x=origin[0]+c+.5,y=origin[1]+r+.5,d=Math.hypot(x-anchor.x,y-anchor.y);
      if(d<3.5||d>8)continue;
      if(bounds.some(b=>pointInBounds({x,y},b,.6)))continue;
      spots.push({x,y,d});
    }
  }
  spots.sort((a,b)=>a.d-b.d||a.x-b.x||a.y-b.y);
  const picked=[];
  for(const spot of spots){
    if(picked.some(p=>Math.hypot(p.x-spot.x,p.y-spot.y)<2.4))continue;
    picked.push(spot);
    if(picked.length>=n)break;
  }
  return picked;
}
/** Two rabbits and two squirrels on the grass near whoever is on the island. Extras are removed. Owned livestock is left alone. */
export function seedAmbient(state,world){
  const list=state.animals||[];
  const counts={rabbit:0,squirrel:0};
  const drop=new Set();
  const ambient=list.filter(isAmbientWildlife).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  for(const animal of ambient){
    if(counts[animal.kind]>=2)drop.add(animal.id);
    else counts[animal.kind]++;
  }
  const need=[];
  if(!state.farm?.ambient){
    for(const kind of ['rabbit','squirrel'])for(let i=counts[kind];i<2;i++)need.push(kind);
  }
  const anchor=wildlifeAnchor(world,state);
  const stray=ambient.filter(animal=>!drop.has(animal.id)&&(terrainAt(world,animal.x,animal.y)!==2||nearShore(world,animal.x,animal.y)||Math.hypot(animal.x-anchor.x,animal.y-anchor.y)>14));
  if(!drop.size&&!need.length&&!stray.length)return state;
  const next=withFarm(state);
  next.animals=list.filter(animal=>!drop.has(animal.id));
  const spots=grassBeside(world,next,anchor,stray.length+need.length);
  let n=0;
  for(const animal of stray){
    const spot=spots[n++];
    if(!spot)continue;
    const saved=next.animals.find(a=>a.id===animal.id);
    if(saved){saved.x=spot.x;saved.y=spot.y;}
  }
  for(const kind of need){
    const spot=spots[n++]||spots.at(-1);
    if(!spot)continue;
    const index=next.animals.filter(animal=>animal.kind===kind&&isAmbientWildlife(animal)).length;
    next.animals.push({id:`ambient-${kind}-${index}`,kind,x:spot.x,y:spot.y,placedAt:0,wild:true});
  }
  next.farm.ambient=1;
  return next;
}

export function farmNightfall(state,world,day){
  const already=(state.farm?.nightDone??-1)>=day;
  if(already)return state;
  const herded=snapHerds(state,world);
  const next=herded===state?withFarm(state):herded;
  const lines=[];
  if(day>=THREAT_DAY){
    const focus=gardenFocus(world,next);
    const seeded=seededCells(next).length>0;
    const count=seeded||(next.animals||[]).some(a=>LIVESTOCK.has(a.kind))?2:1;
    const sides=count===2?[-1,1]:[-1];
    const map=enclosureMap(world,next.buildings);
    const eaten=new Map(),fences=new Map();
    let scared=false;
    next.animals=next.animals.filter(a=>!(a.wild&&a.kind==='coyote'));
    next.farm.integrity={...(next.farm.integrity||{})};
    // Someone standing guard by the garden tonight (Abel's dusk duty) turns the coyotes away from the crops and fences. The animals still get a scare.
    const guard=next.farm.guard?.day===day?next.farm.guard:null;
    if(guard)lines.push(`${guard.name||'Abel'} chased ${sides.length>1?'the coyotes':'a coyote'} away from the garden`);
    // What the garden keeper reads in the morning (garden-keeper.js): which sides the coyotes came through and what they did.
    const attack={day,kind:'coyote',sides:[],ate:0,fenceHit:false,broke:false,guarded:!!guard};
    for(const side of sides){
      if(guard)continue;
      const from=edgeSpawn(world,focus,side),sideName=side>0?'east':'west';
      const barrier=barriersAlong(world,next.buildings,from,focus)[0];
      if(barrier?.scenery){
        if(!fences.has(barrier.scenery))fences.set(barrier.scenery,'A coyote rattled the old garden fence');
        attack.fenceHit=true;
      }else if(barrier?.building){
        const fence=barrier.building,gate=fence.kind==='path';
        const wood=!brickKind(fence.kind),loss=wood?WOOD_LOSS:BRICK_LOSS;
        const left=(next.farm.integrity[fence.id]??1)-loss;
        attack.fenceHit=true;
        if(left<=BREAK_AT){
          const b=next.buildings.find(x=>x.id===fence.id);
          if(b&&b.status==='complete'&&brickKind(b.kind)&&layerCount(b)>1){
            subtractLayer(b.paidMaterials,buildingById(b.kind));
            b.layers=layerCount(b)-1;
            next.farm.integrity[fence.id]=1;
            fences.set(fence.id,'The top brick fell');
          }else{
            if(b&&b.status==='complete')b.status='cancelled';
            delete next.farm.integrity[fence.id];
            fences.set(fence.id,gate?'The garden gate broke':wood?'The wood fence broke':'The brick fence broke');
            attack.broke=true;attack.sides.push(sideName);
          }
        }else{
          next.farm.integrity[fence.id]=Math.round(left*1000)/1000;
          if(!fences.has(fence.id))fences.set(fence.id,gate?'A coyote scratched at the garden gate':wood?'A coyote damaged the wood fence':'A coyote damaged the brick fence');
        }
      }else{
        const open=seededCells(next).filter(([key])=>{
          const p=cellCenter(world,key);
          return !regionAt(map,world,p.x,p.y);
        });
        let got=0;
        for(const [,cell] of open.slice(0,2)){
          const seed=cell?.seed;
          if(eatCrop(cell,nightMinute(day))){eaten.set(seed,(eaten.get(seed)||0)+1);got++;}
        }
        if(got){attack.ate+=got;attack.sides.push(sideName);}
      }
      next.animals.push({id:`coyote-${day}-${side>0?'e':'w'}`,kind:'coyote',x:from.x,y:from.y,placedAt:0,wild:true});
    }
    if(!guard&&(attack.ate||attack.broke||attack.fenceHit))next.farm.lastAttack=attack;
    for(const animal of next.animals){
      if(!LIVESTOCK.has(animal.kind))continue;
      if(regionAt(map,world,animal.x,animal.y)||nearStable(world,next,animal.x,animal.y))continue;
      const away=focus,dx=animal.x-away.x,dy=animal.y-away.y,len=Math.hypot(dx,dy)||1;
      const nx=animal.x+(dx/len)*5,ny=animal.y+(dy/len)*5;
      if(terrainAt(world,nx,ny)===2){animal.x=nx;animal.y=ny;scared=true;}
    }
    lines.push(...eatenLines('coyote',eaten),...fences.values());
    if(scared)lines.push('A coyote scared the animals');
    if(!lines.length)lines.push(sides.length>1?'Two coyotes came by.':'A coyote came by.');
  }
  next.farm.nightLines=lines;
  next.farm.nightLinesDay=day;
  next.farm.nightDone=day;
  return next;
}

export function farmDawn(state,world,day){
  if((state.farm?.dawnDone??-1)>=day)return state;
  const next=withFarm(state);
  const lines=[];
  next.animals=next.animals.filter(a=>!(a.wild&&a.kind==='coyote'));
  if(day>=THREAT_DAY){
    const focus=gardenFocus(world,next);
    const unprotected=seededCells(next).filter(([key])=>{const p=cellCenter(world,key);return !scarecrowCovers(world,next,p.x,p.y);});
    const eaten=new Map();
    for(const [,cell] of unprotected.slice(0,3)){
      const seed=cell?.seed;
      if(eatCrop(cell,dawnMinute(day)))eaten.set(seed,(eaten.get(seed)||0)+1);
    }
    lines.push(...eatenLines('crows',eaten));
    const pecked=[...eaten.values()].reduce((n,v)=>n+v,0);
    if(pecked)next.farm.lastCrowAttack={day,kind:'crow',ate:pecked};
    const crows=next.animals.filter(a=>a.wild&&a.kind==='crow').length;
    for(let i=crows;i<3;i++){
      const p={x:focus.x+(i-1)*3.2,y:focus.y+2.4};
      if(terrainAt(world,p.x,p.y)!==2)continue;
      next.animals.push({id:`crow-${day}-${i}`,kind:'crow',x:p.x,y:p.y,placedAt:0,wild:true});
    }
    if(day>=THREAT_DAY+1){
      const map=enclosureMap(world,next.buildings);
      const gone=[];
      next.animals=next.animals.filter(a=>{
        if(a.kind!=='sheep'||a.wild)return true;
        if(sheepSafe(world,next,a,map))return true;
        if(!hashRoll(a.id,day))return true;
        gone.push(a);return false;
      });
      if(gone.length===1)lines.push('A sheep went missing');
      else if(gone.length)lines.push(`${gone.length} sheep went missing`);
    }
    if(!next.animals.some(a=>a.kind==='snake')){
      const seeded=seededCells(next);
      const covered=seeded.filter(([key])=>{const p=cellCenter(world,key);return scarecrowCovers(world,next,p.x,p.y);});
      const pool=covered.length?covered:seeded;
      if(pool.length){
        const [key]=pool[Math.abs(day)%pool.length];
        const cell=next.cells[key];
        if(cell)cell.hold=1;
        const p=cellCenter(world,key);
        next.animals.push({id:`snake-${day}`,kind:'snake',x:p.x,y:p.y,placedAt:0,wild:true,key});
        lines.push('A snake is in the garden');
      }
    }
  }
  next.farm.dawnLines=lines;
  rememberMorning(next.farm,day);
  next.farm.dawnDone=day;
  return next;
}

/** Replay every dawn and night the clock jumped across. Idempotent via farm.nightDone / dawnDone. */
export function applyFarmSpan(state,world,fromMin,toMin){
  let next=seedAmbient(state,world);
  if(!(toMin>fromMin))return next;
  const events=[];
  for(let d=dayIndex(fromMin)-1;d<=dayIndex(toMin)+1;d++){
    events.push({m:dawnMinute(d),kind:'dawn',day:d});
    events.push({m:nightMinute(d),kind:'night',day:d});
  }
  events.sort((a,b)=>a.m-b.m||(a.kind==='dawn'?-1:1));
  for(const e of events){
    if(e.m<=fromMin+.001||e.m>toMin+.001)continue;
    const updated=e.kind==='night'?farmNightfall(next,world,e.day):farmDawn(next,world,e.day);
    if(updated!==next)next=updated;
  }
  return next;
}

const mat=(THREE,color,rough=.9)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:0});
function piece(THREE,geo,material,x,y,z){
  const mesh=new THREE.Mesh(geo,material);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
/** Clay-brick wall for one grid spot. Same footprint as the wood picket, stacked so the courses read at island zoom. */
function brickFence(THREE){
  const g=new THREE.Group();
  const tones=['#c44732','#b33d2b','#d15a42','#a33828','#c85a3c','#9c3426'].map(c=>mat(THREE,c,.86));
  const W=.96,D=.30,H=.74,rows=4,gap=.05;
  const brickH=(H-gap*(rows+1))/rows,inner=W-gap*2,fullW=(inner-gap)/2,halfW=(fullW-gap)/2;
  let n=0;
  // Mortar sits just inside the brick faces, so the cream lines show in the joints without z-fighting.
  g.add(piece(THREE,new THREE.BoxGeometry(W,H-.02,D*.7),mat(THREE,'#f4e7d6',.96),0,(H-.02)/2,0));
  const brick=(w,x,y)=>g.add(piece(THREE,new THREE.BoxGeometry(w,brickH,D),tones[n++%tones.length],x,y,0));
  for(let row=0;row<rows;row++){
    const y=gap+brickH/2+row*(brickH+gap);
    if(row%2===0){
      brick(fullW,-fullW/2-gap/2,y);
      brick(fullW,fullW/2+gap/2,y);
    }else{
      brick(halfW,-inner/2+halfW/2,y);
      brick(fullW,0,y);
      brick(halfW,inner/2-halfW/2,y);
    }
  }
  g.traverse(o=>{o.frustumCulled=false;});
  return g;
}
/** A squat brick you can lay in a row and stack. Same red clay and mortar as the brick fence. */
function brickBlock(THREE){
  const g=new THREE.Group();
  const tones=['#c44732','#b33d2b','#d15a42','#a33828','#c85a3c','#9c3426'].map(c=>mat(THREE,c,.86));
  const mortar=mat(THREE,'#f4e7d6',.96);
  const S=.96,H=.48,D=.2,gap=.04,rows=2;
  g.add(piece(THREE,new THREE.BoxGeometry(S-.14,H-.02,S-.14),mortar,0,H/2,0));
  let n=0;
  const add=(w,h,d,x,y,z)=>g.add(piece(THREE,new THREE.BoxGeometry(w,h,d),tones[n++%tones.length],x,y,z));
  const brickH=(H-gap*(rows+1))/rows,inner=S-gap*2,fullW=(inner-gap)/2,halfW=(fullW-gap)/2;
  for(let row=0;row<rows;row++){
    const y=gap+brickH/2+row*(brickH+gap),odd=row%2===1,z=S/2-D/2;
    const lay=(alongX,sign)=>{
      const place=(w,t)=>{if(alongX)add(w,brickH,D,t,y,sign*z);else add(D,brickH,w,sign*z,y,t);};
      if(!odd){place(fullW,-fullW/2-gap/2);place(fullW,fullW/2+gap/2);}
      else{place(halfW,-inner/2+halfW/2);place(fullW,0);place(halfW,inner/2-halfW/2);}
    };
    lay(true,1);lay(true,-1);lay(false,1);lay(false,-1);
  }
  g.traverse(o=>{o.frustumCulled=false;});
  return g;
}
function scarecrow(THREE){
  // Chunky on purpose: the old post was 12cm thick and disappeared in the grass at zoom ~19.
  const g=new THREE.Group(),wood=mat(THREE,'#8d5a32'),straw=mat(THREE,'#e2c15a'),hat=mat(THREE,'#6d4428'),cloth=mat(THREE,'#c4553a'),face=mat(THREE,'#3a2418');
  g.add(piece(THREE,new THREE.BoxGeometry(.26,1.85,.26),wood,0,.925,0));
  g.add(piece(THREE,new THREE.BoxGeometry(1.45,.16,.16),wood,0,1.48,0));
  g.add(piece(THREE,new THREE.BoxGeometry(.62,.52,.2),cloth,0,1.22,.02));
  g.add(piece(THREE,new THREE.SphereGeometry(.34,12,10),straw,0,1.95,0));
  g.add(piece(THREE,new THREE.CylinderGeometry(.5,.5,.08,12),hat,0,2.22,0));
  g.add(piece(THREE,new THREE.CylinderGeometry(.24,.3,.22,12),hat,0,2.36,0));
  for(const x of [-.62,.62])g.add(piece(THREE,new THREE.BoxGeometry(.1,.22,.1),straw,x,1.32,.02));
  g.add(piece(THREE,new THREE.BoxGeometry(.08,.08,.06),face,-.1,2.02,.3));
  g.add(piece(THREE,new THREE.BoxGeometry(.08,.08,.06),face,.1,2.02,.3));
  g.add(piece(THREE,new THREE.BoxGeometry(.16,.05,.05),face,0,1.86,.3));
  g.traverse(o=>{o.frustumCulled=false;});
  return g;
}
function stable(THREE){
  const g=new THREE.Group(),wood=mat(THREE,'#a56b3c'),dark=mat(THREE,'#6e4328'),roof=mat(THREE,'#8d4d38'),straw=mat(THREE,'#d7b15a');
  g.add(piece(THREE,new THREE.BoxGeometry(2.7,.12,1.7),straw,0,.06,0));
  for(const x of [-1.2,1.2])for(const z of [-.7,.7])g.add(piece(THREE,new THREE.BoxGeometry(.16,1.5,.16),dark,x,.8,z));
  g.add(piece(THREE,new THREE.BoxGeometry(2.5,1.05,.1),wood,0,.85,-.75));
  g.add(piece(THREE,new THREE.BoxGeometry(.1,1.05,1.5),wood,-1.25,.85,0));
  g.add(piece(THREE,new THREE.BoxGeometry(.1,1.05,1.5),wood,1.25,.85,0));
  const roofL=piece(THREE,new THREE.BoxGeometry(3,.1,1.15),roof,0,1.7,-.35);roofL.rotation.x=-.35;g.add(roofL);
  const roofR=piece(THREE,new THREE.BoxGeometry(3,.1,1.15),roof,0,1.7,.35);roofR.rotation.x=.35;g.add(roofR);
  return g;
}
function meshHeight(THREE,root){
  const box=new THREE.Box3().setFromObject(root);
  return Number.isFinite(box.max.y)&&Number.isFinite(box.min.y)?box.max.y-box.min.y:0;
}
/** Toy-block meshes for the new buildables. A real library model wins if one is already registered.
 *  A scarecrow that is missing or only a flat slab does not count — kids need to see the post and head. */
export function registerFarmAssets(library,THREE){
  const kinds={brick_fence:brickFence,brick:brickBlock,scarecrow,stable};
  for(const [kind,build] of Object.entries(kinds)){
    for(const stage of ['foundation','frame','complete']){
      const id=`building_${kind}_${stage}`;
      const existing=library[id];
      if(existing&&(kind!=='scarecrow'||meshHeight(THREE,existing)>1.2))continue;
      const root=build(THREE);root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
    }
  }
}
