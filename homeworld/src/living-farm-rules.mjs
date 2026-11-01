import {gardenFresh,gardenRestore} from './living-garden-rules.mjs';
// A small, private test economy. These coins never spend the app's account coins.
export const FARM_CYCLE_MS=3*60*1000, FIRST_EGG_MS=20000, PRODUCE_CAP=3;
export const FARM_PRICES={chicken:10,cow:40,egg:5,milk:10};
/** Farm animals bought at the market with island coins. Chicken and cow keep their named-shop prices. */
export const MARKET_ANIMALS=[
 {id:'sheep',name:'Sheep',emoji:'🐑',price:50},
 {id:'goat',name:'Goat',emoji:'🐐',price:25},
 {id:'donkey',name:'Donkey',emoji:'🫏',price:20},
 {id:'horse',name:'Horse',emoji:'🐴',price:170},
 {id:'dog_terrier',name:'Terrier',emoji:'🐶',price:15},
 {id:'dog_hound',name:'Hound',emoji:'🐕',price:25},
 {id:'dog_shepherd',name:'Shepherd dog',emoji:'🐕‍🦺',price:65},
];
export const marketAnimal=id=>MARKET_ANIMALS.find(a=>a.id===id)||null;
export const farmFresh=()=>({version:1,coins:0,garden:gardenFresh(),chickenDismissed:false,coop:0,animals:[],bag:{egg:0,milk:0},collected:0,eggsCollected:0,nextId:1});
const integer=(v,max=100000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
export const animalName=v=>String(v||'').trim().replace(/[\u0000-\u001f<>]/g,'').slice(0,24);
export function farmRestore(v){
  if(!v||v.version!==1||!integer(v.coins)||!integer(v.coop,2)||!Array.isArray(v.animals)||v.animals.length>8||!integer(v.nextId)||v.nextId<1)return farmFresh();
  const ids=new Set();
  for(const a of v.animals){if(!a||!['chicken','cow'].includes(a.kind)||typeof a.id!=='string'||!a.id.startsWith('living-farm-')||ids.has(a.id)||!animalName(a.name)||!integer(a.ready,PRODUCE_CAP)||!Number.isFinite(a.nextAt)||a.nextAt<0)return farmFresh();ids.add(a.id);}
  if(v.animals.some(a=>Number(a.id.slice('living-farm-'.length))>=v.nextId))return farmFresh();
  if(!integer(v.bag?.egg)||!integer(v.bag?.milk)||!integer(v.collected))return farmFresh();
  return {...v,coop:Math.max(v.coop,v.animals.some(a=>a.kind==='chicken')?1:0),eggsCollected:integer(v.eggsCollected)?v.eggsCollected:0,garden:gardenRestore(v.garden),chickenDismissed:v.chickenDismissed===true,animals:v.animals.map(a=>({...a,name:animalName(a.name)})),bag:{...v.bag}};
}
export const coopCapacity=level=>level===0?0:level===1?3:6;
export function farmOffer(s,kind){
  const count=k=>s.animals.filter(a=>a.kind===k).length;
  if(kind==='coop')return {price:s.coop===0?20:40,reason:s.coop>=2?'Your coop is as big as it needs to be!':null,capacity:coopCapacity(s.coop+1)};
  if(!['chicken','cow'].includes(kind))return {price:0,reason:'Choose an animal.'};
  const reason=kind==='chicken'&&!s.coop?'Build a coop first.':kind==='chicken'&&count(kind)>=coopCapacity(s.coop)?'Make your coop bigger first.':kind==='cow'&&s.coop<1?'Build your first coop before welcoming a cow.':kind==='cow'&&count(kind)>=2?'Your two cows have a lovely home here.':null;
  return {price:FARM_PRICES[kind],reason};
}
export function farmPurchaseError(s,kind,name,now){
 const offer=farmOffer(s,kind);
 return offer.reason||(!Number.isFinite(now)?'Please try again.':s.coins<offer.price?`You have ${s.coins} coins. Sell vegetables or eggs at the market to earn ${offer.price-s.coins} more.`:null);
}
export function farmBuy(s,kind,name,now){
  const offer=farmOffer(s,kind);if(farmPurchaseError(s,kind,name,now))return s;
  if(kind==='coop')return {...s,coins:s.coins-offer.price,coop:s.coop+1};
  const clean=animalName(name)||(kind==='chicken'?'Chicken':'Cow');
  const animal={id:`living-farm-${s.nextId}`,kind,name:clean,ready:0,nextAt:now+(s.animals.length===0?FIRST_EGG_MS:FARM_CYCLE_MS)};
  return {...s,coins:s.coins-offer.price,nextId:s.nextId+1,animals:[...s.animals,animal]};
}
export function farmAdvance(s,now){
  let changed=false;
  const animals=s.animals.map(a=>{
    if(now<a.nextAt||a.ready>=PRODUCE_CAP)return a;
    const cycles=1+Math.floor((now-a.nextAt)/FARM_CYCLE_MS);changed=true;
    return {...a,ready:Math.min(PRODUCE_CAP,a.ready+cycles),nextAt:a.nextAt+cycles*FARM_CYCLE_MS};
  });return changed?{...s,animals}:s;
}
export function farmCollect(s,id,now){
  const animal=s.animals.find(a=>a.id===id);if(!animal?.ready)return s;
  const item=animal.kind==='chicken'?'egg':'milk';
  return {...s,collected:s.collected+animal.ready,eggsCollected:(s.eggsCollected||0)+(item==='egg'?animal.ready:0),bag:{...s.bag,[item]:s.bag[item]+animal.ready},animals:s.animals.map(a=>a===animal?{...a,ready:0,nextAt:a.ready>=PRODUCE_CAP?now+FARM_CYCLE_MS:a.nextAt}:a)};
}
export function farmUse(s,item,action){
  if(!['egg','milk'].includes(item)||!['eat','sell'].includes(action)||s.bag[item]<1)return s;
  return {...s,bag:{...s.bag,[item]:s.bag[item]-1},coins:s.coins+(action==='sell'?FARM_PRICES[item]:0)};
}
