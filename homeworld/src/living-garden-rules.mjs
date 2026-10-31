// The opening garden and its reward share the farm receipt: a reload cannot pay twice.
export const GARDEN_REWARD=10, HARVEST_COINS=2, GARDEN_GROW_MS=45000;
export const GARDEN_CROPS=['carrot','pumpkin','cabbage'];
export const gardenFresh=()=>({approved:false,dug:0,planted:0,dugSpots:[],plantedSpots:[],completed:false,readyAt:[0,0,0,0,0,0]});
export function gardenRestore(v){
 if(!v||!Number.isInteger(v.dug)||v.dug<0||v.dug>3||!Number.isInteger(v.planted)||v.planted<0||v.planted>v.dug||!Array.isArray(v.readyAt)||v.readyAt.length!==6||!v.readyAt.every(t=>Number.isFinite(t)&&t>=0))return gardenFresh();
 const dugSpots=v.dugSpots??[3,4,5].slice(0,v.dug),plantedSpots=v.plantedSpots??[3,4,5].slice(0,v.planted);
 const valid=a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(i=>[3,4,5].includes(i));
 if(!valid(dugSpots)||!valid(plantedSpots)||dugSpots.length!==v.dug||plantedSpots.length!==v.planted||plantedSpots.some(i=>!dugSpots.includes(i)))return gardenFresh();
 return {approved:v.approved===true||v.dug>0,dug:v.dug,planted:v.planted,dugSpots:[...dugSpots],plantedSpots:[...plantedSpots],completed:v.planted===3,readyAt:[...v.readyAt]};
}
export function gardenAvailable(g){return g.completed?[]:[3,4,5].filter(i=>!(g.dug<3?g.dugSpots:g.plantedSpots).includes(i));}
export function gardenNext(g){return g.completed?null:{kind:g.dug<3?'dig':'plant',index:gardenAvailable(g)[0]};}
export function gardenApprove(s){return s.garden.approved?s:{...s,garden:{...s.garden,approved:true}};}
export function gardenWork(s,kind,index,now){
 const g=s.garden,next=gardenNext(g);
 if(!g.approved||!next||next.kind!==kind||!gardenAvailable(g).includes(index)||!Number.isFinite(now)||now<0)return s;
 if(kind==='dig')return {...s,garden:{...g,dug:g.dug+1,dugSpots:[...g.dugSpots,index]}};
 const readyAt=[...g.readyAt];readyAt[index]=now+GARDEN_GROW_MS;
 const completed=g.planted===2;
 return {...s,coins:s.coins+(completed?GARDEN_REWARD:0),garden:{...g,planted:g.planted+1,plantedSpots:[...g.plantedSpots,index],completed,readyAt}};
}
export function gardenHarvest(s,index,now){
 const g=s.garden;if(!g.completed||!Number.isInteger(index)||index<0||index>5||!Number.isFinite(now)||now<g.readyAt[index])return s;
 const readyAt=[...g.readyAt];readyAt[index]=now+GARDEN_GROW_MS;
 return {...s,coins:s.coins+HARVEST_COINS,garden:{...g,readyAt}};
}
// Only replace the untouched demo planting. Gardens a child worked on stay intact.
export function prepareLivingGardenBase(s,world){
 if(s.livingGardenLayout)return s;
 const slots=new Set(world.gardenSlots.map(p=>p.key));
 const untouched=!['plowed','planted','harvested','weedsCleared'].some(k=>s.stats[k]>0)&&Object.keys(s.cells).every(k=>slots.has(k));
 return {...s,livingGardenLayout:untouched?'small':'existing',...(untouched?{cells:{}}:{})};
}
