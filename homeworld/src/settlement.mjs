/**
 * The village mind (pure rules, no network).
 *
 * The island grows through stages: Camp → Homestead → Village → Harbour Town. Each stage lists the
 * buildings and upgrades that finish it. `nextGoal` picks the next feasible one (the kid can
 * sway it by setting a build goal), `villageNeeds` turns that into quantities every friend
 * can work toward, and `creditSkill` lets each friend learn from what they actually do, so
 * collected characters grow into the role they practise most. The runtime that acts on this
 * lives in village.js; chores that answer the needs live in residents.js.
 */
import {buildingById,activeBuildings,woodTotal,materialStatus,upgradeCost} from './building.mjs';
import {projectPlan,assignedProject,projectProgress} from './project-rules.mjs';
import {completedHomes,FOODS} from './nutrition.mjs';
import {characterFor,ROLES} from './characters.mjs';

const HOME_RANK={tent:0,hut:1,cottage:2,townhouse:3};

export const STAGES=[
  {id:'camp',name:'Camp',motto:'A tent to sleep in and a fire to cook on.',
    goals:[{kind:'tent'},{kind:'campfire'}]},
  {id:'homestead',name:'Homestead',motto:'A first real home, a garden and somewhere to keep the logs.',
    goals:[{kind:'hut'},{kind:'garden'},{kind:'wood_store_20'}]},
  {id:'village',name:'Village',motto:'Room for everyone, meals together and water close by.',
    goals:[{kind:'cottage',upgrade:'hut'},{kind:'dining_hall'},{kind:'wood_store_50'},{kind:'hut',count:2},{kind:'well'}]},
  // Same ladder as stages.mjs (Camp → Homestead → Village → Harbour Town). The market and the dock come first
  // here so travellers (travellers.js) start calling by boat as soon as the village plan is done.
  {id:'harbour_town',name:'Harbour Town',motto:'A market and a dock by the water, workshops, a stable and a church on the hill.',
    goals:[{kind:'market'},{kind:'dock'},{kind:'forge'},{kind:'stable'},{kind:'townhouse',upgrade:'cottage'},{kind:'oven'},{kind:'hut',count:5},{kind:'church'}]},
];

/** Activities a friend can get better at, and what each action teaches. */
export const ACTIVITIES={
  wood:{name:'Woodcutter',icon:'axe'},
  stone:{name:'Miner',icon:'mine'},
  fishing:{name:'Fisher',icon:'fish'},
  garden:{name:'Gardener',icon:'water_drop'},
  cooking:{name:'Cook',icon:'cookedfish'},
  building:{name:'Builder',icon:'build'},
};
const ACTION_XP={
  chop_hit:['wood',1],pickup_wood:['wood',1],dig_stump:['wood',2],
  mine_hit:['stone',1],
  fish:['fishing',2],
  water:['garden',2],plant:['garden',2],harvest:['garden',2],plow:['garden',2],clear_weeds:['garden',2],pick_apples:['garden',1],guard_garden:['garden',3],
  cook:['cooking',2],serve_meal:['cooking',3],stoke:['cooking',1],
  place_building:['building',4],begin_building:['building',2],finish_building:['building',4],upgrade_building:['building',4],stack_piece:['building',1],
};
export const LEVELS=[{at:0,name:'Helper'},{at:20,name:'Apprentice'},{at:60,name:'Journeyman'},{at:150,name:'Master'}];

/** Island save slice `village` after a character did `actionType` (pure). */
export function creditSkill(village,characterId,actionType){
  const hit=ACTION_XP[actionType];if(!hit||!characterId)return village;
  const [activity,amount]=hit,xp=village?.xp||{},mine=xp[characterId]||{};
  return {...(village||{}),xp:{...xp,[characterId]:{...mine,[activity]:(mine[activity]||0)+amount}}};
}
export const skillXp=(state,id,activity)=>state?.village?.xp?.[id]?.[activity]||0;
export function skillLevel(xp){let level=0;for(let i=0;i<LEVELS.length;i++)if(xp>=LEVELS[i].at)level=i;return level;}
/** Canon role (characters.mjs ROLES) → the practice activity it ranks in. Roles without a matching activity rank on all practice. */
export const ROLE_ACTIVITY={cook:'cooking',gardener:'garden',woodcutter:'wood',farmer:'garden',builder:'building',fisher:'fishing',shepherd:null,teacher:null,leader:null,healer:null};
/**
 * The role a friend shows on cards and the village strip: {activity,name,icon,level,levelName,xp,next,title,fixed}.
 * Named base friends (Eve, Noah, Adam, Abel) carry the fixed `rankTitle` from characters.mjs — Eve is the Master Chef
 * however much she plants between meals. Friends with a canon role rank in that role's activity only (a Bible builder is
 * never an "apprentice gardener"); collected friends with no role grow into whatever they practise most.
 */
export function learnedRole(state,id){
  const mine=state?.village?.xp?.[id]||{},canon=characterFor(state?.characters?.[id]?.name||id);
  const total=Object.values(mine).reduce((a,b)=>a+b,0);
  if(canon.rankTitle){
    const activity=ROLE_ACTIVITY[canon.roleId]||null,[levelName,...rest]=canon.rankTitle.split(' ');
    return {activity,name:rest.join(' ')||canon.roleName,icon:canon.icon,level:LEVELS.length-1,levelName,xp:activity?mine[activity]||0:total,next:null,title:canon.rankTitle,fixed:true};
  }
  let activity,xp,name,icon;
  if(canon.roleId){
    activity=ROLE_ACTIVITY[canon.roleId]||null;xp=activity?mine[activity]||0:total;
    const role=ROLES[canon.roleId];name=role?.name||canon.roleName;icon=canon.icon||role?.icon;
  }else{
    const top=Object.entries(mine).sort((a,b)=>b[1]-a[1])[0];
    if(!top)return null;
    [activity,xp]=top;name=ACTIVITIES[activity].name;icon=ACTIVITIES[activity].icon;
  }
  if(xp<10)return null;
  const level=skillLevel(xp),next=LEVELS[level+1]?.at??null,levelName=LEVELS[level].name;
  return {activity,name,icon,level,levelName,xp,next,title:`${levelName} ${name}`,fixed:false};
}
/** Work-speed bonus from practice: up to +24% at Master. */
export const practiceRate=(state,id,activity)=>1+skillLevel(skillXp(state,id,activity))*.08;

const complete=state=>activeBuildings(state).filter(b=>b.status==='complete');
function countFor(state,goal){
  const done=complete(state);
  if(HOME_RANK[goal.kind]!==undefined&&goal.kind!=='tent')return done.filter(b=>(HOME_RANK[b.kind]??-1)>=HOME_RANK[goal.kind]).length;
  return done.filter(b=>b.kind===goal.kind).length;
}
const underway=(state,kind)=>activeBuildings(state).some(b=>b.status!=='complete'&&b.kind===kind);
export const goalDone=(state,goal)=>countFor(state,goal)>=(goal.count||1);

/** A complete home of `kind` that could be upgraded now (nobody asleep in it). */
function upgradable(state,kind){
  return complete(state).find(b=>b.kind===kind&&!Object.values(state.characters||{}).some(c=>c.sleep?.homeId===b.id));
}
function describe(state,goal,stage){
  const def=buildingById(goal.kind);if(!def)return null;
  const chars=Object.keys(state.characters||{}).length,plan=projectPlan(goal.kind);
  const old=goal.upgrade?upgradable(state,goal.upgrade):null;
  const cost=goal.upgrade?(old?upgradeCost(old):null):def;
  const need={wood:Math.max(0,cost?.wood||0),stone:Math.max(0,cost?.stone||0),clay:def.clay||0};
  const have={wood:woodTotal(state),stone:state.inventory?.stone||0,clay:state.inventory?.clay||0};
  const missing={wood:Math.max(0,need.wood-have.wood),stone:Math.max(0,need.stone-have.stone),clay:Math.max(0,need.clay-have.clay)};
  let blocked=null;
  if(goal.upgrade&&!old)blocked=`Needs a ${buildingById(goal.upgrade)?.name||goal.upgrade} to upgrade.`;
  else if(plan&&chars<plan.crew)blocked=`Needs ${plan.crew} friends on the island (we are ${chars}).`;
  else if(plan&&!completedHomes(state).length)blocked='Needs a Prayer Tent first so the crew can sleep.';
  else if(def.requiresShovel&&(state.tools?.shovel||0)<def.requiresShovel)blocked='Needs a shovel from the Tools bench.';
  else if(need.clay>have.clay)blocked=`Needs ${missing.clay} clay brick${missing.clay===1?'':'s'} (dig mud at the beach).`;
  const materials=goal.upgrade?(old?materialStatus(state,def.id,upgradeCost(old)).ok:false):materialStatus(state,def.id).ok;
  return {kind:def.id,name:def.name,upgradeId:old?.id||null,upgradeFrom:goal.upgrade||null,count:goal.count||1,have:countFor(state,goal),need,inventory:have,missing,
    blocked,ready:!blocked&&materials,underway:underway(state,goal.kind),crew:plan?.crew||1,stage:stage.id,stageName:stage.name};
}

/** The stage the island is in: the first one with something left to build. */
export function settlementStage(state){
  for(let i=0;i<STAGES.length;i++){
    const stage=STAGES[i],left=stage.goals.filter(g=>!goalDone(state,g));
    if(left.length)return {index:i,stage,done:stage.goals.length-left.length,total:stage.goals.length,left};
  }
  const last=STAGES.at(-1);return {index:STAGES.length-1,stage:last,done:last.goals.length,total:last.goals.length,left:[]};
}

/** True when the pinned build is already satisfied, so the village must not raise another one. */
export function focusSatisfied(state,kind){
  if(!kind||!buildingById(kind))return false;
  const match=STAGES.flatMap(s=>s.goals).find(g=>g.kind===kind);
  if(match)return goalDone(state,match);
  return countFor(state,{kind})>=1;
}

/**
 * The next thing the village should raise. `focus` (a building kind the kid asked for)
 * jumps the queue when it is still unfinished; a pin that is already done is ignored.
 * Returns the first goal that is not blocked, or the first blocked one so the plan can say what it is waiting for.
 */
export function nextGoal(state,focus=null){
  const here=settlementStage(state);
  const queue=[];
  if(focus&&buildingById(focus)&&!focusSatisfied(state,focus)){
    const inStage=STAGES.flatMap(s=>s.goals.map(g=>({goal:g,stage:s}))).find(x=>x.goal.kind===focus&&!goalDone(state,x.goal));
    if(inStage)queue.push({...inStage,focus:true});
    else queue.push({goal:{kind:focus},stage:here.stage,focus:true});
  }
  for(const g of here.left)if(!queue.some(q=>q.goal.kind===g.kind))queue.push({goal:g,stage:here.stage});
  const described=queue.map(q=>{const d=describe(state,q.goal,q.stage);return d&&{...d,focus:!!q.focus||q.goal.kind===focus};}).filter(Boolean);
  return described.find(d=>!d.blocked&&!d.underway)||described.find(d=>!d.underway)||described[0]||null;
}

/** Quantities the whole village can chip in on right now, derived from the next goal and the pantry. */
export function villageNeeds(state,focus=null){
  const goal=nextGoal(state,focus),needs={wood:0,stone:0,fish:0,goal};
  if(goal&&!goal.blocked){needs.wood=goal.missing.wood;needs.stone=goal.missing.stone;}
  const mouths=Object.keys(state.characters||{}).length||1,inv=state.inventory||{};
  const meals=Object.keys(FOODS).reduce((n,id)=>n+(inv[id]||0),0);
  if(meals<mouths&&(inv.fish||0)<mouths)needs.fish=mouths-(inv.fish||0);
  return needs;
}

/** Everything the plan card shows. */
export function villagePlan(state,focus=null){
  const here=settlementStage(state),goal=nextGoal(state,focus);
  // Honest status for the strip: what is actually under construction right now (which day of how many), versus the
  // next goal that is only planned (gathering) or ready for a builder.
  const siteOf=b=>{const plan=projectPlan(b.kind),progress=projectProgress(b);return {id:b.id,kind:b.kind,name:buildingById(b.kind)?.name||b.kind,status:b.status,days:plan?.days||null,day:plan&&progress!==null?Math.min(plan.days,Math.floor(progress*plan.days)+1):null,percent:progress!==null?Math.round(progress*100):null,started:b.status==='building'||(progress||0)>0};};
  const sites=activeBuildings(state).filter(b=>b.status!=='complete'&&b.status!=='cancelled').map(siteOf);
  const building=sites.find(s=>s.started)||sites[0]||null;
  if(goal)goal.phase=sites.some(s=>s.kind===goal.kind)?'building':goal.blocked?'blocked':goal.ready?'ready':'gathering';
  const roster=Object.entries(state.characters||{}).map(([id,c])=>({id,name:c.name||id,role:learnedRole(state,id),busy:!!assignedProject(state,id)}));
  return {stage:{id:here.stage.id,name:here.stage.name,motto:here.stage.motto,index:here.index,total:STAGES.length,done:here.done,goals:here.total},
    goal,building,needs:villageNeeds(state,focus),
    upcoming:here.left.map(g=>({kind:g.kind,name:buildingById(g.kind)?.name||g.kind,done:goalDone(state,g),upgrade:g.upgrade||null,count:g.count||1,have:countFor(state,g)})),
    later:STAGES.slice(here.index+1).map(s=>s.name),roster};
}
