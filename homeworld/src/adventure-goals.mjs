// Goal progress lives in the existing per-child island save. No separate wallet or timers.
import {BUILDINGS} from './building.mjs';
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
 {id:'fish',title:'Catch my first fish',description:'Visit the dock and bring home a fish of your own.',art:'build_dock.png',emoji:'🐟',color:'blue',steps:[
  {id:'catch',label:'Catch 1 fish at the dock',metric:'fishCaught',count:1,action:'fish'}]},
 ...['hut','cottage','church'].map((id,i)=>({id,title:['Make a cozy hut','Make a cottage','Build our church'][i],description:['Gather supplies and build a cozy place to call home.','Make a bigger home with room to welcome friends.','Create a special place for your community to gather.'][i],art:`build_${id}.png`,emoji:['🏡','🏠','⛪'][i],color:['peach','blue','green'][i],later:true,steps:[
  {id:'wood',label:`Gather ${building(id).wood} wood`,metric:'wood',count:building(id).wood,action:'axe',stock:true},
  {id:'stone',label:`Gather ${building(id).stone} stone`,metric:'stone',count:building(id).stone,action:'mine',stock:true},
  {id:'build',label:`Finish your ${building(id).name.toLowerCase()}`,metric:`building:${id}`,count:1,action:`build:${id}`,stock:true}]})),
];
export const goalById=id=>GOALS.find(g=>g.id===id);
const number=v=>Number.isFinite(v)?Math.max(0,v):0;
export function goalFacts(state={}){
 const facts={...state.stats};
 facts.wood=Object.entries(state.inventory||{}).filter(([id])=>id.endsWith('_wood')).reduce((n,[,v])=>n+number(v),0);
 facts.stone=number(state.inventory?.stone);
 for(const id of ['hut','cottage','church'])facts[`building:${id}`]=(state.buildings||[]).filter(b=>b.kind===id&&b.status==='complete').length;
 return facts;
}
export function restoreGoals(value){
 const clean={version:1,active:null,records:{},celebrate:null};
 if(value?.version!==1)return clean;
 for(const g of GOALS){const r=value.records?.[g.id];if(!r||!Array.isArray(r.progress)||r.progress.length!==g.steps.length)continue;
  clean.records[g.id]={base:Object.fromEntries(Object.entries(r.base||{}).map(([k,v])=>[k,number(v)])),progress:g.steps.map((s,i)=>Math.min(s.count,number(r.progress[i]))),stepBase:r.stepBase==null?null:number(r.stepBase),completed:r.completed===true&&g.steps.every((s,i)=>number(r.progress[i])>=s.count)};
 }
 if(clean.records[value.active]&&!clean.records[value.active].completed)clean.active=value.active;
 if(clean.records[value.celebrate]?.completed)clean.celebrate=value.celebrate;
 return clean;
}
export function availableGoals(saved,facts){
 return GOALS.filter(g=>!saved.records[g.id]?.completed&&(!g.later||Object.values(saved.records).some(r=>r.completed))&&(g.id!=='cottage'||facts['building:hut']>0)&&(g.id!=='church'||facts['building:hut']>0||facts['building:cottage']>0));
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
