// Dining Hall rules (pure): where the seats are, and how a shared meal is dished out of the bag.
import {FOODS,MAX_HUNGER,foodFill,hungerFor,energyFor} from './nutrition.mjs';
import {activeBuildings,buildingById,footprint} from './building.mjs';

export const HALL_KIND='dining_hall';
export const completedHalls=state=>activeBuildings(state).filter(b=>b.kind===HALL_KIND&&b.status==='complete');
export const hallById=(state,id)=>completedHalls(state).find(b=>b.id===id)||completedHalls(state)[0]||null;

/**
 * Seats in building-local metres: x runs along the table, z is across it (+z is the hall's front,
 * where workPoint stands). Eight bench seats, then standing places at the table ends. `face` is the
 * point a diner looks at (the table in front of them).
 */
export const HALL_SEATS=[-1.8,-.6,.6,1.8].flatMap(x=>[{x,z:.85,face:{x,z:0}},{x,z:-.85,face:{x,z:0}}]).concat([{x:2.95,z:0,face:{x:0,z:0},standing:true},{x:-2.95,z:0,face:{x:0,z:0},standing:true}]);
/** Where the cook stands to set the table (the table's head). */
export const HALL_SERVING_SPOT={x:2.95,z:0,face:{x:0,z:0}};
export const TABLE_TOP_Y=.78,BENCH_TOP_Y=.45;

/** Building-local (x,z) → island (x,y) for a placed building. Matches construction.js: rotation.y = rotation·π/2. */
export function hallPoint(world,b,local){
  const fp=footprint(world,b),a=b.rotation*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
  return {x:fp.center.x+local.x*c+local.z*s,y:fp.center.y+local.x*s-local.z*c};
}
/** A spot just outside the hall's front or back edge, in line with the seat, that the path finder can reach. */
export function hallApproach(world,b,seat){
  const def=buildingById(b.kind),depth=def.size[1]/2+.8,side=seat.z<0?-1:seat.z>0?1:(seat.x>=0?1:-1);
  return seat.z===0?hallPoint(world,b,{x:Math.sign(seat.x)*(def.size[0]/2+.8),z:0}):hallPoint(world,b,{x:seat.x,z:side*depth});
}
export const seatYaw=(world,b,seat)=>{const p=hallPoint(world,b,seat),f=hallPoint(world,b,seat.face);return Math.atan2(f.x-p.x,-(f.y-p.y));};

/**
 * Dish out one shared meal. Hungriest first; each diner gets the best-fitting food for what their tummy
 * still needs (largest fill that does not overshoot by more than a bite, else the smallest on the shelf),
 * at most three helpings. Food that is not needed never leaves the bag. Returns the servings and who is
 * still hungry afterwards. `diners` = [{id,name}] — ids must exist in state.characters.
 */
export const MAX_HELPINGS=3,OVERSHOOT_BITE=18,MIN_WORTH=12;
export function planMeal(state,diners,minutes){
  const shelf={};for(const id of Object.keys(FOODS))if((state.inventory[id]||0)>0)shelf[id]=state.inventory[id];
  const need=new Map(diners.map(d=>[d.id,MAX_HUNGER-hungerFor(state,minutes,d.id)]));
  const order=[...diners].sort((a,b)=>need.get(b.id)-need.get(a.id));
  const servings=[],stillHungry=[];
  for(let round=0;round<MAX_HELPINGS;round++){
    for(const d of order){
      const deficit=need.get(d.id);if(deficit<MIN_WORTH)continue;
      const options=Object.keys(shelf).filter(id=>shelf[id]>0).map(id=>({id,fill:foodFill(id),energy:FOODS[id].energy}));
      if(!options.length)break;
      const fits=options.filter(o=>o.fill<=deficit+OVERSHOOT_BITE).sort((a,b)=>b.fill-a.fill||b.energy-a.energy)[0]||options.sort((a,b)=>a.fill-b.fill)[0];
      shelf[fits.id]--;need.set(d.id,Math.max(0,deficit-fits.fill));servings.push({id:d.id,item:fits.id});
    }
  }
  for(const d of order)if(need.get(d.id)>=MAX_HUNGER*.4)stillHungry.push(d.id);
  const served={};for(const s of servings)served[s.item]=(served[s.item]||0)+1;
  return {servings,served,stillHungry,empty:!Object.keys(shelf).length&&!servings.length};
}
export const servedLabel=served=>Object.entries(served).map(([id,n])=>`${n} ${FOODS[id]?.name.toLowerCase()||id}${n>1&&!/fish$/.test(FOODS[id]?.name||'')?'s':''}`).join(', ')||'nothing';
export const dinerEnergy=(state,id)=>energyFor(state,id);
