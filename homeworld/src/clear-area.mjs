import {activeTrees,activeRocks,activeStumps,cellAt,cellFromKey,gameTime,terrainType} from './core.mjs';
import {footprint,activeBuildings} from './building.mjs';

export const CLEAR_AREA_CAP=400;
// Bound work before allocating geometry; dragging backwards produces the same rectangle.
export function clearRectangle(start,end,cap=CLEAR_AREA_CAP){
 const a=String(start).split(':').map(Number),b=String(end).split(':').map(Number);
 if(a.length!==2||b.length!==2||![...a,...b].every(Number.isSafeInteger))return [];
 const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
 if((x1-x0+1)*(y1-y0+1)>cap)return [];
 const keys=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)keys.push(`${x}:${y}`);return keys;
}
export function clearableKeys(world,state,keys,protectedKeys=[]){
 const protectedSet=new Set(protectedKeys);
 for(const building of activeBuildings(state))for(const key of footprint(world,building)?.keys||[])protectedSet.add(key);
 return [...new Set(keys)].filter(key=>{const p=cellFromKey(world,key);return terrainType(world,p.x,p.y)>0&&!protectedSet.has(key)&&!state.cells?.[key]?.soil;});
}
export function clearTargets(world,state,keys,protectedKeys=[]){
 const selected=new Set(clearableKeys(world,state,keys,protectedKeys));
 const inside=item=>selected.has(cellAt(world,...item.position).key);
 return [
  ...activeTrees(world,state,gameTime(state)).filter(t=>t.species!=='apple'&&!t.cell&&inside(t)).map(t=>({...t,type:'chop'})),
  ...activeStumps(world,state).filter(inside).map(t=>({...t,type:'dig_stump'})),
  ...activeRocks(world,state).filter(inside).map(r=>({...r,type:'mine_hit'})),
 ];
}
