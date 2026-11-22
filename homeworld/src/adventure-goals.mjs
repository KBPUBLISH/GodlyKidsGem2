// Goal progress lives in the existing per-child island save. No separate wallet or timers.
import {BUILDINGS,materialStatus} from './building.mjs';
import {woodStorage} from './wood-storage.mjs';
const building=id=>BUILDINGS.find(b=>b.id===id);
export const GOALS=[
 {id:'garden',title:'Grow my garden',description:'Make a little patch of green, from soil to your first harvest.',art:'build_garden.png',emoji:'🌱',color:'green',steps:[
  {id:'soil',label:'Till 5 soil squares',metric:'plowed',count:5,action:'hoe'},
  {id:'plant',label:'Plant 5 seeds',metric:'planted',count:5,action:'plant'},
  {id:'water',label:'Water 5 plants',metric:'watered',count:5,action:'water'},
  {id:'harvest',label:'Harvest 5 crops',metric:'harvested',count:5,action:'harvest'}]},
 {id:'wood',title:'Gather wood together',description:'Cut three trees, then enjoy a snack to get your energy back.',art:'build_wood_store_20.png',emoji:'🪵',color:'peach',steps:[
  {id:'trees',label:'Cut down 3 trees',metric:'trees',count:3,action:'axe'},
  {id:'snack',label:'Eat a snack',metric:'mealsEaten',count:1,action:'food',after:true}]},
 {id:'fish',title:'Grill a fish',description:'Catch a fish, grill it by the fire, then enjoy it or share with a friend.',art:'build_campfire.png',emoji:'🐟',color:'blue',steps:[
  {id:'catch',label:'Catch 1 fish at the dock',metric:'fishReady',count:1,action:'fish',stock:true},
  {id:'fire',label:'Build a campfire',metric:'building:campfire',count:1,action:'build:campfire',stock:true},
  {id:'grill',label:'Grill your fish',metric:'grilledReady',count:1,action:'grill',stock:true},
  {id:'enjoy',label:'Eat or share your grilled fish',metric:'fishEnjoyed',count:1,action:'enjoy-fish'}]},
 {id:'chicken',title:'Welcome a chicken',description:'Build a cozy coop, then buy your first chicken. A small coop has room for three!',art:'build_hut.png',emoji:'🐔',color:'peach',steps:[
  {id:'coop',label:'Build a coop · 20 coins',metric:'coop',count:1,action:'coop',stock:true},
  {id:'buy',label:'Buy a chicken · 10 coins',metric:'chickens',count:1,action:'chicken',stock:true}]},
 {id:'flock',title:'Three feathered friends',description:'Give three chickens a home in your coop.',art:'build_hut.png',emoji:'🐔',color:'green',requires:'chicken',steps:[
  {id:'coop',label:'Build a coop',metric:'coop',count:1,action:'coop',stock:true},
  {id:'flock',label:'Welcome 3 chickens',metric:'chickens',count:3,action:'chicken',stock:true}]},
 {id:'eggs',title:'My first eggs',description:'Visit your chickens and collect three fresh eggs.',art:'build_garden.png',emoji:'🥚',color:'peach',requires:'chicken',steps:[
  {id:'collect',label:'Collect 3 eggs',metric:'eggsCollected',count:3,action:'eggs'}]},
 {id:'basket',title:'Fill my harvest basket',description:'Grow more good food for your island.',art:'build_garden.png',emoji:'🥕',color:'green',later:true,steps:[
  {id:'plant',label:'Plant 3 seeds',metric:'planted',count:3,action:'plant'},
  {id:'water',label:'Water 3 plants',metric:'watered',count:3,action:'water'},
  {id:'pick',label:'Pick 3 vegetables',metric:'harvested',count:3,action:'harvest'}]},
 {id:'stone',title:'Gather building stones',description:'Break three rocks and save stone for your next big build.',art:'build_church.png',emoji:'🪨',color:'blue',later:true,steps:[
  {id:'rocks',label:'Break 3 rocks',metric:'rocks',count:3,action:'mine'}]},
 ...['hut','cottage','church'].map((id,i)=>({id,title:['Make a cozy hut','Make a cottage','Build our church'][i],description:['Gather supplies and build a cozy place to call home.','Make a bigger home with room to welcome friends.','Create a special place for your community to gather.'][i],art:`build_${id}.png`,emoji:['🏡','🏠','⛪'][i],color:['peach','blue','green'][i],later:true,steps:[
  {id:'wood',label:`Gather ${building(id).wood} wood`,metric:'wood',count:building(id).wood,action:'axe',stock:true},
  {id:'stone',label:`Gather ${building(id).stone} stone`,metric:'stone',count:building(id).stone,action:'mine',stock:true},
  {id:'build',label:`Finish your ${building(id).name.toLowerCase()}`,metric:`building:${id}`,count:1,action:`build:${id}`,stock:true}]})),
];
// Building goals use the real catalogue costs, including clay and bundled materials.
const existing=new Set(GOALS.map(g=>g.id));
for(const b of BUILDINGS.filter(b=>!existing.has(b.id)&&!b.stroke)){
 GOALS.push({id:b.id,title:b.id==='oven'?'Build my first kitchen':`Build my ${b.name.toLowerCase()}`,description:b.description,art:`build_${b.poster||b.id}.png`,emoji:'🏗️',color:'blue',later:!['oven'].includes(b.id),steps:[
  ...[['wood',b.wood,'axe'],['stone',b.stone,'mine'],['clay',b.clay,'clay'],...Object.entries(b.bundle||{}).map(([id,n])=>[id,n,id==='wheat'?'plant':'bricks'])].filter(([,n])=>n>0).map(([id,n,action])=>({id,label:`Gather ${n} ${id.replaceAll('_',' ')}`,metric:id,count:n,action,stock:true})),
  {id:'build',label:`Place and finish your ${b.name.toLowerCase()}`,metric:`building:${b.id}`,count:1,action:`build:${b.id}`,stock:true}
 ]});
}
// More demanding garden goals become available as earlier harvests are achieved.
for(const [i,count] of [12,24,48,96].entries())GOALS.push({id:`harvest-${count}`,title:`Grow a ${count}-crop harvest`,description:'Expand your garden and grow food together for the whole community.',art:'build_garden.png',emoji:'🥕',color:'green',requires:i?`harvest-${[12,24,48,96][i-1]}`:'garden',steps:[{id:'plant',label:`Plant ${count} seeds`,metric:'planted',count,action:'plant'},{id:'harvest',label:`Harvest ${count} crops`,metric:'harvested',count,action:'harvest'}]});
for(const g of GOALS){const b=BUILDINGS.find(b=>g.steps.some(s=>s.action===`build:${b.id}`));if(b?.wood>20)g.steps.unshift({id:'storage',label:`Make room for ${b.wood} wood`,metric:'woodCapacity',count:b.wood,action:'storage',stock:true});}
export const FIRST_GOALS=['chicken','garden','cottage','oven','fish'];
GOALS.sort((a,b)=>(FIRST_GOALS.includes(a.id)?FIRST_GOALS.indexOf(a.id):99)-(FIRST_GOALS.includes(b.id)?FIRST_GOALS.indexOf(b.id):99));
export const goalById=id=>GOALS.find(g=>g.id===id);
const number=v=>Number.isFinite(v)?Math.max(0,v):0;
export function goalFacts(state={}){
 const facts={...state.stats};
 facts.woodCapacity=woodStorage({...state,inventory:state.inventory||{}}).capacity;
 facts.fishReady=number(state.inventory?.fish)+number(state.inventory?.cooked_fish);
 facts.grilledReady=number(state.inventory?.cooked_fish);
 facts.fishEnjoyed=number(state.stats?.fishEaten)+number(state.stats?.fishShared);
 facts.coop=number(state.livingFarm?.coop);
 facts.chickens=(state.livingFarm?.animals||[]).filter(a=>a.kind==='chicken').length;
 facts.eggsCollected=number(state.livingFarm?.eggsCollected);
 facts.wood=Object.entries(state.inventory||{}).filter(([id])=>id.endsWith('_wood')).reduce((n,[,v])=>n+number(v),0);
 facts.stone=number(state.inventory?.stone);
 Object.assign(facts,state.inventory||{});
 for(const id of BUILDINGS.map(b=>b.id))facts[`building:${id}`]=(state.buildings||[]).filter(b=>b.kind===id&&b.status==='complete').length;
 return facts;
}
export function restoreGoals(value){
 const clean={version:1,active:null,records:{},celebrate:null};
 if(value?.version!==1)return clean;
 for(const g of GOALS){let r=value.records?.[g.id];if(g.id==='fish'&&r?.progress?.length===1)r={...r,progress:[r.progress[0],0,0,0],completed:false};if(g.steps[0].id==='storage'&&r?.progress?.length===g.steps.length-1)r={...r,progress:[r.completed?g.steps[0].count:0,...r.progress]};if(!r||!Array.isArray(r.progress)||r.progress.length!==g.steps.length)continue;
  clean.records[g.id]={base:Object.fromEntries(Object.entries(r.base||{}).map(([k,v])=>[k,number(v)])),progress:g.steps.map((s,i)=>Math.min(s.count,number(r.progress[i]))),stepBase:r.stepBase==null?null:number(r.stepBase),completed:r.completed===true&&g.steps.every((s,i)=>number(r.progress[i])>=s.count)};
 }
 if(clean.records[value.active]&&!clean.records[value.active].completed)clean.active=value.active;
 if(clean.records[value.celebrate]?.completed)clean.celebrate=value.celebrate;
 return clean;
}
export function availableGoals(saved,facts){
 return GOALS.filter(g=>!saved.records[g.id]?.completed&&(!g.requires||saved.records[g.requires]?.completed)&&(!g.later||FIRST_GOALS.includes(g.id)||Object.values(saved.records).some(r=>r.completed))&&(g.id!=='church'||facts['building:hut']>0||facts['building:cottage']>0));
}
export function chooseGoal(value,id,facts){
 const s=restoreGoals(value),g=goalById(id);if(!g||!availableGoals(s,facts).some(x=>x.id===id))return s;
 return {...s,active:id,celebrate:null,records:{...s.records,[id]:s.records[id]||{base:{...facts},progress:g.steps.map(()=>0),stepBase:null,completed:false}}};
}
export function advanceGoal(value,facts){
 const s=restoreGoals(value),g=goalById(s.active);if(!g)return s;
 const r=s.records[g.id],progress=[...r.progress];let stepBase=r.stepBase;
 // A finished creation already satisfies its resource-gathering steps.
 const result=g.steps.at(-1);
 if(g.id==='fish'){if(number(facts.grilledReady)>0)progress.splice(0,3,1,1,1);if(number(facts.fishEnjoyed)>number(r.base.fishEnjoyed))progress.splice(0,4,1,1,1,1);}
 if(result.metric.startsWith('building:')&&number(facts[result.metric])>=result.count)g.steps.forEach((step,i)=>{progress[i]=step.count;});
 for(let i=0;i<g.steps.length;i++){
  const step=g.steps[i];if(progress[i]>=step.count)continue;
  if(step.after&&stepBase===null){stepBase=number(facts[step.metric]);break;}
  const base=step.stock?0:step.after?stepBase:number(r.base[step.metric]);
  progress[i]=Math.max(progress[i],Math.min(step.count,Math.max(0,number(facts[step.metric])-base)));
  if(progress[i]<step.count)break;
  stepBase=null;
 }
 const completed=g.steps.every((step,i)=>progress[i]>=step.count);
 return {...s,active:completed?null:s.active,celebrate:completed?g.id:s.celebrate,records:{...s.records,[g.id]:{...r,progress,stepBase,completed}}};
}

/** Select a building without opening placement or creating an NPC request. */
export function selectBuildingGoal(game,kind){
 const state=game.store.state,goal=goalById(kind);if(!goal)return false;
 // A deliberate catalogue choice can select a later building too.
 const saved=restoreGoals(state.adventureGoals),facts=goalFacts(state);
 const records={...saved.records,[kind]:saved.records[kind]||{base:{...facts},progress:goal.steps.map(()=>0),stepBase:null,completed:false}};
 if(records[kind].completed)return false;
 game.store.save({...state,adventureGoals:advanceGoal({...saved,active:kind,celebrate:null,records},facts)});
 game.building?.cancelPreview();game.notify?.();return true;
}
/** Recompute from live inventory so helpers stop gathering once enough is available. */
export function communityGoalFocus(state){
 const saved=restoreGoals(state?.adventureGoals),goal=goalById(saved.active);if(!goal)return null;
 const facts=goalFacts(state),record=saved.records[goal.id];
 const step=goal.steps.find((s,i)=>record.progress[i]<s.count);if(!step)return null;
 const building=BUILDINGS.find(b=>goal.steps.some(s=>s.action===`build:${b.id}`));
 let chores=[];
 if(building){
  const needed= facts.woodCapacity<building.wood ? BUILDINGS.find(b=>b.id===(facts.woodCapacity<60?'wood_store_50':'wood_store_200')) : building;
  if(facts.wood<needed.wood)chores.push('chop');
  if(facts.stone<needed.stone)chores.push('mine');
  if(materialStatus(state,building.id).ok)chores.push('build');
 }else if(['garden','basket'].includes(goal.id)||goal.id.startsWith('harvest-'))chores=['plow','plant','water','harvest','weeds','pickup','gardenWork'];
 else if(goal.id==='wood')chores=facts.trees-(record.base.trees||0)<3?['chop']:[];
 else if(goal.id==='stone')chores=['mine'];
 else if(goal.id==='fish'){if(!facts['building:campfire']){if(facts.wood<5)chores.push('chop');if(facts.stone<3)chores.push('mine');}if(!facts.fishReady)chores.push('fish');if(facts.wood>0)chores.push('stoke');}
 else if(['chicken','flock','eggs'].includes(goal.id))chores=['farm','water','harvest'];
 return {id:'player-goal',title:goal.title,chores,kind:building?.id||null};
}
