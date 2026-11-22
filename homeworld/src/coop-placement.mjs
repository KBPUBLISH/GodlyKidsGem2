import {cellAt,terrainType,activeTrees,activeRocks,inBlocker} from './core.mjs';
import {activeBuildings,footprint,pointInBounds} from './building.mjs';
export function coopPlacementStatus(world,state,p){
 if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return false;
 for(let dx=-1.8;dx<=1.8;dx+=.45)for(let dy=-1.85;dy<=1.2;dy+=.45){const q={x:p.x+dx,y:p.y+dy};
  if(state.cells?.[cellAt(world,q.x,q.y).key]?.soil||terrainType(world,q.x,q.y)===0||world.blockers.some(b=>inBlocker(b,q.x,q.y,.15))||activeBuildings(state).some(b=>pointInBounds(q,footprint(world,b).bounds,.2)))return false;
 }
 return !activeTrees(world,state).some(t=>Math.abs(t.position[0]-p.x)<1.8+t.radius&&Math.abs(t.position[1]-p.y)<1.85+t.radius)&&!activeRocks(world,state).some(r=>Math.abs(r.position[0]-p.x)<1.8+r.radius&&Math.abs(r.position[1]-p.y)<1.85+r.radius);
}
// A finger tap may land just beside a clear square. Snap nearby, preserving every obstacle.
export function coopSpotNear(world,state,p){
 if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||terrainType(world,p.x,p.y)===0)return null;
 if(coopPlacementStatus(world,state,p))return p;
 for(let r=.5;r<=3;r+=.5)for(let i=0;i<8;i++){const a=i*Math.PI/4,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(coopPlacementStatus(world,state,q))return q;}
 return null;
}
