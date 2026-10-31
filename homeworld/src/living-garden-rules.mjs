// Starter tasks and their rewards share one durable farm receipt.
export const GARDEN_REWARD=10, HARVEST_COINS=2, GARDEN_GROW_MS=45000, STARTER_GROW_MS=8000;
export const CARROT_SPOTS=[0,3,4,5];
export const PICK_CROPS=['carrot','pumpkin','lettuce'];
export const GARDEN_CROPS=['carrot','pumpkin','lettuce','carrot','carrot','carrot'];
const picks=()=>({carrot:0,pumpkin:0,lettuce:0});
export const gardenFresh=()=>({version:2,approved:true,dug:4,dugSpots:[...CARROT_SPOTS],planted:0,plantedSpots:[],picked:picks(),rewarded:false,completed:false,readyAt:[0,0,0,0,0,0]});
const validTimes=v=>Array.isArray(v)&&v.length===6&&v.every(t=>Number.isFinite(t)&&t>=0);
export function gardenRestore(v){
 if(!v||!validTimes(v.readyAt))return gardenFresh();
 if(v.version===2){
  const spots=v.plantedSpots;
  if(!Array.isArray(spots)||new Set(spots).size!==spots.length||spots.some(i=>!CARROT_SPOTS.includes(i))||v.planted!==spots.length||!PICK_CROPS.every(c=>[0,1].includes(v.picked?.[c])))return gardenFresh();
  const picked=spots.length===4?{...v.picked}:picks();
  return {...gardenFresh(),planted:spots.length,plantedSpots:[...spots],picked,rewarded:v.rewarded===true||spots.length===4,completed:spots.length===4&&PICK_CROPS.every(c=>picked[c]===1),readyAt:[...v.readyAt]};
 }
 // Credit earlier garden work and its already-paid reward when updating a test save.
 if(!Number.isInteger(v.dug)||v.dug<0||v.dug>3||!Number.isInteger(v.planted)||v.planted<0||v.planted>v.dug)return gardenFresh();
 const dug=v.dugSpots??[3,4,5].slice(0,v.dug),planted=v.plantedSpots??[3,4,5].slice(0,v.planted);
 const valid=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(i=>[3,4,5].includes(i));
 if(!valid(dug)||!valid(planted)||dug.length!==v.dug||planted.length!==v.planted||planted.some(i=>!dug.includes(i)))return gardenFresh();
 const done=v.planted===3,spots=done?[...CARROT_SPOTS]:[...planted];
 return {...gardenFresh(),planted:spots.length,plantedSpots:spots,rewarded:done,readyAt:[...v.readyAt]};
}
export function gardenAvailable(g){
 if(g.completed)return [];
 return g.planted<4?CARROT_SPOTS.filter(i=>!g.plantedSpots.includes(i)):GARDEN_CROPS.map((c,i)=>g.picked[c]?null:i).filter(i=>i!==null);
}
export function gardenNext(g){
 const available=gardenAvailable(g);if(!available.length)return null;
 const index=g.planted<4?available[0]:available.sort((a,b)=>g.readyAt[a]-g.readyAt[b])[0];
 return {kind:g.planted<4?'plant':'harvest',index};
}
export function gardenWork(s,kind,index,now){
 const g=s.garden;if(kind!=='plant'||g.planted>=4||!gardenAvailable(g).includes(index)||!Number.isFinite(now)||now<0)return s;
 const readyAt=[...g.readyAt];readyAt[index]=now+STARTER_GROW_MS;
 const planted=g.planted+1,reward=planted===4&&!g.rewarded;
 return {...s,coins:s.coins+(reward?GARDEN_REWARD:0),garden:{...g,planted,plantedSpots:[...g.plantedSpots,index],rewarded:g.rewarded||reward,readyAt}};
}
export function gardenHarvest(s,index,now){
 const g=s.garden;if(g.planted<4||!Number.isInteger(index)||index<0||index>5||!Number.isFinite(now)||now<g.readyAt[index])return s;
 const readyAt=[...g.readyAt];readyAt[index]=now+GARDEN_GROW_MS;
 const picked={...g.picked,[GARDEN_CROPS[index]]:1};
 return {...s,coins:s.coins+HARVEST_COINS,garden:{...g,picked,completed:PICK_CROPS.every(c=>picked[c]===1),readyAt}};
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
