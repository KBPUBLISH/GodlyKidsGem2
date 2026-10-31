// Starter tasks and their rewards share one durable farm receipt.
export const GARDEN_REWARD=10, HARVEST_COINS=2, GARDEN_GROW_MS=Object.freeze({lettuce:120000,carrot:180000,pumpkin:360000});
export const CARROT_SPOTS=[0,3,4,5];
export const PICK_CROPS=['carrot','pumpkin','lettuce'];
export const GARDEN_CROPS=['carrot','pumpkin','lettuce','carrot','carrot','carrot'];
const picks=()=>({carrot:0,pumpkin:0,lettuce:0});
export const gardenFresh=()=>({version:3,approved:true,dug:4,dugSpots:[...CARROT_SPOTS],planted:0,plantedSpots:[],picked:picks(),rewarded:false,completed:false,readyAt:[0,0,0,0,0,0],wateredAt:[null,0,0,null,null,null]});
const validTimes=v=>Array.isArray(v)&&v.length===6&&v.every(t=>Number.isFinite(t)&&t>=0);
export function gardenRestore(v,now=Date.now()){
 if(!v||!validTimes(v.readyAt))return gardenFresh();
 if(v.version===2||v.version===3){
  const spots=v.plantedSpots;
  if(!Array.isArray(spots)||new Set(spots).size!==spots.length||spots.some(i=>!CARROT_SPOTS.includes(i))||v.planted!==spots.length||!PICK_CROPS.every(c=>[0,1].includes(v.picked?.[c])))return gardenFresh();
  const picked=spots.length===4?{...v.picked}:picks();
  const planted=i=>!CARROT_SPOTS.includes(i)||spots.includes(i);
  if(v.version===3&&(!Array.isArray(v.wateredAt)||v.wateredAt.length!==6||v.wateredAt.some((t,i)=>t!==null&&(!Number.isFinite(t)||t<0||v.readyAt[i]<t))))return gardenFresh();
  // Keep already ripe crops when upgrading; old automatic regrowth must now wait for water.
  const wateredAt=v.version===3?[...v.wateredAt]:v.readyAt.map((t,i)=>planted(i)&&t<=now?0:null);
  const readyAt=v.readyAt.map((t,i)=>wateredAt[i]===null?0:t);
  return {...gardenFresh(),planted:spots.length,plantedSpots:[...spots],picked,rewarded:v.rewarded===true||spots.length===4,completed:spots.length===4&&PICK_CROPS.every(c=>picked[c]===1),readyAt,wateredAt};
 }
 // Credit earlier garden work and its already-paid reward when updating a test save.
 if(!Number.isInteger(v.dug)||v.dug<0||v.dug>3||!Number.isInteger(v.planted)||v.planted<0||v.planted>v.dug)return gardenFresh();
 const dug=v.dugSpots??[3,4,5].slice(0,v.dug),planted=v.plantedSpots??[3,4,5].slice(0,v.planted);
 const valid=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(i=>[3,4,5].includes(i));
 if(!valid(dug)||!valid(planted)||dug.length!==v.dug||planted.length!==v.planted||planted.some(i=>!dug.includes(i)))return gardenFresh();
 const done=v.planted===3,spots=done?[...CARROT_SPOTS]:[...planted];
 return gardenRestore({...gardenFresh(),version:2,planted:spots.length,plantedSpots:spots,rewarded:done,readyAt:[...v.readyAt]},now);
}
/** The timer only starts when a planted patch has actually been watered. */
export function gardenCrop(g,index,now=Date.now()){
 if(!Number.isInteger(index)||index<0||index>=GARDEN_CROPS.length)return null;
 const crop=GARDEN_CROPS[index],duration=GARDEN_GROW_MS[crop],planted=!CARROT_SPOTS.includes(index)||g.plantedSpots.includes(index);
 const watered=g.wateredAt[index]!==null,remaining=planted&&watered?Math.max(0,g.readyAt[index]-now):duration;
 const phase=!planted?'empty':!watered?'thirsty':remaining?'growing':'ready';
 return {crop,phase,duration,remaining,progress:!planted||!watered?0:Math.max(0,Math.min(1,1-remaining/duration))};
}
export function gardenAvailable(g){
 if(g.completed)return GARDEN_CROPS.map((_,i)=>i);
 return g.planted<4?CARROT_SPOTS.filter(i=>!g.plantedSpots.includes(i)):GARDEN_CROPS.map((c,i)=>g.picked[c]?null:i).filter(i=>i!==null);
}
export function gardenJob(g,index,now=Date.now()){
 if(!gardenAvailable(g).includes(index))return null;
 const crop=gardenCrop(g,index,now);
 return {kind:{empty:'plant',thirsty:'water',growing:'wait',ready:'harvest'}[crop.phase],index,...crop};
}
export function gardenNext(g,now=Date.now()){
 const jobs=gardenAvailable(g).map(i=>gardenJob(g,i,now));
 const priority=g.completed?['harvest','water','plant','wait']:['plant','water','harvest','wait'];
 return jobs.sort((a,b)=>priority.indexOf(a.kind)-priority.indexOf(b.kind)||a.remaining-b.remaining)[0]||null;
}
export function gardenWork(s,kind,index,now){
 const g=s.garden;if(!Number.isFinite(now)||now<0)return s;
 const crop=gardenCrop(g,index,now);if(!crop)return s;
 if(kind==='water'){
  if(g.planted<4||crop.phase!=='thirsty')return s;
  const readyAt=[...g.readyAt],wateredAt=[...g.wateredAt];readyAt[index]=now+crop.duration;wateredAt[index]=now;
  return {...s,garden:{...g,readyAt,wateredAt}};
 }
 if(kind!=='plant'||g.planted>=4||!gardenAvailable(g).includes(index))return s;
 const readyAt=[...g.readyAt],wateredAt=[...g.wateredAt];readyAt[index]=0;wateredAt[index]=null;
 const planted=g.planted+1,reward=planted===4&&!g.rewarded;
 return {...s,coins:s.coins+(reward?GARDEN_REWARD:0),garden:{...g,planted,plantedSpots:[...g.plantedSpots,index],rewarded:g.rewarded||reward,readyAt,wateredAt}};
}
export function gardenHarvest(s,index,now){
 const g=s.garden;if(g.planted<4||!Number.isFinite(now)||now<0||gardenCrop(g,index,now)?.phase!=='ready')return s;
 const readyAt=[...g.readyAt],wateredAt=[...g.wateredAt];readyAt[index]=0;wateredAt[index]=null;
 const picked={...g.picked,[GARDEN_CROPS[index]]:1};
 return {...s,coins:s.coins+HARVEST_COINS,garden:{...g,picked,completed:PICK_CROPS.every(c=>picked[c]===1),readyAt,wateredAt}};
}
export function starterTasks(g,tentBuilt){
 const planted=g.planted===4,harvested=PICK_CROPS.every(c=>g.picked[c]===1);
 return [
  {id:'plant',label:'Plant 4 carrot seeds',icon:'plant',value:g.planted,total:4,done:planted,locked:false},
  {id:'pick',label:'Pick 1 of each',accessibleLabel:'Pick 1 carrot, 1 pumpkin and 1 lettuce',icon:'harvest',value:PICK_CROPS.filter(c=>g.picked[c]).length,total:3,done:harvested,locked:!planted,crops:PICK_CROPS.map(c=>({id:c,done:!!g.picked[c]}))},
  {id:'tent',label:'Build a tent',icon:'build',value:tentBuilt?1:0,total:1,done:tentBuilt,locked:!harvested},
 ];
}
// Only replace the untouched demo planting. Gardens a child worked on stay intact.
export function prepareLivingGardenBase(s,world){
 if(s.livingGardenLayout)return s;
 const slots=new Set(world.gardenSlots.map(p=>p.key));
 const untouched=!['plowed','planted','harvested','weedsCleared'].some(k=>s.stats[k]>0)&&Object.keys(s.cells).every(k=>slots.has(k));
 return {...s,livingGardenLayout:untouched?'small':'existing',...(untouched?{cells:{}}:{})};
}
