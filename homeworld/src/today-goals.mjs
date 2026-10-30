/**
 * Today's large goals — one per friend, plus a single extra the kid can add.
 *
 * Goals are roles (expand the garden, feed the island), not the chores those roles create.
 * The chores stay in the autopilot (garden-keeper, dining, pickSkillChores, settlement build).
 * An override only changes WHICH of those existing chores a friend is allowed to pick up today.
 *
 * Saved on the island as `village.todayGoals` (the save key is already per kid via storage-scope.mjs).
 * A bag from a previous island day is ignored, so the override clears when the day rolls.
 */
import {characterFor,characterKey} from './characters.mjs';
import {skillFor} from './character-skills.mjs';
import {POPULATION,STAGE_LADDER,population} from './stages.mjs';
import {gameTime,timeLabel} from './core.mjs';

/** Large goals. `chores` are kinds the autopilot already knows how to do. */
export const GOALS={
  garden:{id:'garden',title:'Expand the garden',icon:'water',chores:['guard','weeds','harvest','plow','water','plant','pickup','gardenWork']},
  buildings:{id:'buildings',title:'Expand the buildings',icon:'build',chores:['chop','stump','mine','build']},
  flock:{id:'flock',title:'Tend the flock',icon:'walk',chores:['farm','guard','chop']},
  feed:{id:'feed',title:'Feed the island',icon:'cookedfish',chores:['fish','plant','pickup','harvest','stoke','water']},
  guard:{id:'guard',title:'Stand guard',icon:'fence',chores:['guard']},
  kitchen:{id:'kitchen',title:'Help the kitchen',icon:'food',chores:['fish','plant','pickup','harvest','stoke']},
  wood:{id:'wood',title:'Stock wood',icon:'axe',chores:['chop','stump']},
  raise:{id:'raise',title:'Raise a building',icon:'build',chores:['chop','stump','mine','build']},
};

/** Canon defaults the user set for the first four friends. */
const NAMED={abel:'garden',noah:'buildings',adam:'flock',eve:'feed'};
/** Collected friends follow their role: a builder helps the buildings, a gardener the garden. */
const ROLE_GOAL={
  gardener:'garden',cook:'feed',farmer:'flock',shepherd:'flock',builder:'buildings',woodcutter:'buildings',
  fisher:'feed',teacher:'garden',leader:'buildings',healer:'feed',
};
/** 3–5 large goals that fit a friend, plus the foreman option the card adds itself. */
const FITS={
  garden:['garden','guard','kitchen','feed','flock'],
  buildings:['buildings','wood','raise','flock','guard'],
  flock:['flock','garden','wood','buildings','guard'],
  feed:['feed','kitchen','garden','flock'],
  guard:['guard','garden','kitchen','flock'],
  kitchen:['kitchen','feed','garden','flock'],
  wood:['wood','buildings','raise','flock'],
  raise:['raise','buildings','wood','flock'],
};
const PREFER={
  garden:['gardener'],buildings:['woodcutter','builder'],flock:['farmer','shepherd'],feed:['cook','fisher'],
  guard:['gardener','shepherd'],kitchen:['cook','fisher'],wood:['woodcutter','builder','farmer'],raise:['woodcutter','builder'],
};
const NAMED_BOOST={garden:'abel',buildings:'noah',flock:'adam',feed:'eve',wood:'noah',raise:'noah',kitchen:'eve',guard:'abel'};

export function defaultGoalId(name){
  const key=characterKey(name);
  if(NAMED[key])return NAMED[key];
  const role=skillFor(name)?.id||characterFor(name)?.roleId;
  return ROLE_GOAL[role]||'feed';
}

export function fitsFor(name){
  const id=defaultGoalId(name);
  return (FITS[id]||FITS.feed).map(gid=>GOALS[gid]).filter(Boolean);
}

/** Title for the settlement project as ONE goal ("Raise the Small Hut"), not its material list. */
export function projectTitle(project){
  if(!project?.name)return null;
  if(project.upgradeFrom||project.upgradeId)return `Upgrade to the ${project.name}`;
  return `Raise the ${project.name}`;
}

export function optionsFor(name,project){
  const titled=projectTitle(project);
  return fitsFor(name).map(g=>{
    if(g.id==='raise'&&titled&&project?.kind)return {id:'raise',title:titled,kind:project.kind};
    return {id:g.id,title:g.title,kind:null};
  });
}

/** The add-a-goal list: four large goals, plus the current settlement project when there is one. */
export function addChoices(project){
  const list=[
    {id:'garden',title:'Expand the garden',kind:null},
    {id:'raise',title:'Raise a building',kind:null},
    {id:'flock',title:'Tend the flock',kind:null},
    {id:'feed',title:'Feed the island',kind:null},
  ];
  const titled=projectTitle(project);
  if(titled&&project?.kind)list.splice(2,0,{id:'raise',title:titled,kind:project.kind});
  return list;
}

/** Who should carry a goal the kid just added. Named friends win, then anyone with that role. */
export function bestFriend(crew,goalId){
  const roles=PREFER[goalId]||[];
  const named=NAMED_BOOST[goalId];
  let best=null,score=-1;
  for(const c of crew||[]){
    const key=characterKey(c.name);
    const role=skillFor(c.name)?.id||characterFor(c.name)?.roleId||'';
    let s=1;
    if(key===named)s+=10;
    if(roles.includes(role))s+=5;
    if(defaultGoalId(c.name)===goalId)s+=2;
    if(s>score){score=s;best=c;}
  }
  return best;
}

export function islandDay(state){
  try{return timeLabel(gameTime(state)).day;}catch{return 1;}
}

function normOverride(value){
  if(!value||value==='off')return null;
  if(typeof value==='string'&&GOALS[value])return {id:value,title:GOALS[value].title,kind:null};
  if(value&&GOALS[value.id])return {id:value.id,title:value.title||GOALS[value.id].title,kind:value.kind||null};
  return null;
}

/** Today's bag. A previous island day's overrides are dropped. */
export function todayBag(state,day=islandDay(state)){
  const raw=state?.village?.todayGoals;
  if(!raw||raw.day!==day)return {day,overrides:{},extra:null};
  const overrides=raw.overrides&&typeof raw.overrides==='object'?{...raw.overrides}:{};
  const extra=raw.extra?.goalId&&raw.extra?.who&&GOALS[raw.extra.goalId]
    ?{goalId:raw.extra.goalId,who:raw.extra.who,title:raw.extra.title||GOALS[raw.extra.goalId].title,kind:raw.extra.kind||null}
    :null;
  return {day,overrides,extra};
}

export function withToday(village,bag){
  return {...(village||{}),todayGoals:{day:bag.day,overrides:bag.overrides,extra:bag.extra}};
}

/**
 * What the autopilot should follow. `null` means the foreman's default (don't filter — existing
 * garden, dining, skill and settlement work stays as it is). `{id:'off'}` means the kid dismissed
 * today's goal and hasn't picked a new one yet.
 */
export function focusFor(state,residentId,name,day=islandDay(state)){
  const bag=todayBag(state,day);
  if(bag.overrides[residentId]==='off')return {id:'off',title:'Pick a new goal',chores:[],kind:null};
  const ov=normOverride(bag.overrides[residentId]);
  if(ov){const g=GOALS[ov.id];return {...g,title:ov.title,kind:ov.kind};}
  if(bag.extra?.who===residentId){const g=GOALS[bag.extra.goalId];return {...g,title:bag.extra.title||g.title,kind:bag.extra.kind};}
  return null;
}

/** True when this friend should still run the meal (Eve fishes, Noah grills). A reassignment takes them off it. */
export function servesMeal(state,residentId,name){
  const focus=focusFor(state,residentId,name);
  return !focus||focus.id==='feed'||focus.id==='kitchen';
}

/** What the card shows for one friend. */
export function displayGoal(state,residentId,name,day=islandDay(state)){
  const bag=todayBag(state,day);
  if(bag.overrides[residentId]==='off')return {id:'off',title:'Pick a new goal',picked:false,yours:false,dismissed:true};
  const ov=normOverride(bag.overrides[residentId]);
  if(ov)return {id:ov.id,title:ov.title,picked:true,yours:bag.extra?.who===residentId,dismissed:false};
  if(bag.extra?.who===residentId&&GOALS[bag.extra.goalId]){
    const g=GOALS[bag.extra.goalId];
    return {id:g.id,title:bag.extra.title||g.title,picked:true,yours:true,dismissed:false};
  }
  const g=GOALS[defaultGoalId(name)];
  return {id:g.id,title:g.title,picked:false,yours:false,dismissed:false};
}

export function dismissOverride(bag,id){
  const overrides={...bag.overrides,[id]:'off'};
  const extra=bag.extra?.who===id?null:bag.extra;
  return {...bag,overrides,extra};
}

export function setOverride(bag,id,choice){
  const overrides={...bag.overrides};
  if(!choice||choice.foreman){
    delete overrides[id];
    const extra=bag.extra?.who===id?null:bag.extra;
    return {...bag,overrides,extra};
  }
  const title=choice.title||GOALS[choice.id]?.title;
  if(!GOALS[choice.id]||!title)return bag;
  overrides[id]={id:choice.id,title,kind:choice.kind||null};
  let extra=bag.extra;
  if(extra?.who===id&&(extra.goalId!==choice.id||extra.title!==title))extra=null;
  return {...bag,overrides,extra};
}

export function assignExtra(bag,crew,choice){
  if(!choice||!GOALS[choice.id])return {bag,who:null};
  const who=bestFriend(crew,choice.id);
  if(!who)return {bag,who:null};
  const overrides={...bag.overrides};
  if(bag.extra?.who&&bag.extra.who!==who.id){
    const prev=normOverride(overrides[bag.extra.who]);
    if(prev&&prev.id===bag.extra.goalId&&prev.title===(bag.extra.title||GOALS[bag.extra.goalId].title))delete overrides[bag.extra.who];
  }
  const title=choice.title||GOALS[choice.id].title;
  overrides[who.id]={id:choice.id,title,kind:choice.kind||null};
  const extra={goalId:choice.id,who:who.id,title,kind:choice.kind||null};
  return {bag:{...bag,overrides,extra},who};
}

export function clearExtra(bag){
  if(!bag.extra)return bag;
  const overrides={...bag.overrides};
  const ov=normOverride(overrides[bag.extra.who]);
  if(ov&&ov.id===bag.extra.goalId&&ov.title===(bag.extra.title||GOALS[bag.extra.goalId].title))delete overrides[bag.extra.who];
  return {...bag,overrides,extra:null};
}

/**
 * People meter for the real ladder (stages.mjs). People are the headline.
 * The bar fills toward the next population milestone the island has not reached
 * (Camp 10, Homestead 20, Village 40, Harbour Town 60). Current and next are the
 * journey stages, not a second ladder.
 */
export function peopleMeter(stages,state){
  const counted=stages?.island?.people;
  const people=Math.max(0,Number.isFinite(counted)?counted:(population(state)||0));
  const index=stages?.index||0;
  const here=stages?.stage?.name?stages.stage:STAGE_LADDER[0];
  const next=STAGE_LADDER[index+1]||null;
  let gate=null;
  for(const s of STAGE_LADDER){if(people<POPULATION[s.id]){gate=s;break;}}
  const need=gate?POPULATION[gate.id]:POPULATION.harbour_town;
  const gap=Math.max(0,need-people);
  const full=!gate;
  const pct=need>0?Math.max(0,Math.min(1,people/need)):1;
  return {
    people,need,gap,full,pct,
    current:{id:here.id,name:here.name,icon:here.icon||'camp'},
    next:next?{id:next.id,name:next.name,icon:next.icon}:null,
    gateName:gate?.name||'Harbour Town',
  };
}

/**
 * Gold the island shop already spends: `game.coins`, posted by My Home as the active
 * profile's `useUser().coins` (`gk-coins`). There is no island wallet. When the parent
 * has not posted yet, read that same save (`godly_kids_data_v6`) the way UserContext
 * hydrates the active profile — kid coins capped by the root balance — so the number
 * is the one the shop would show.
 */
export function readShipCoins(){
  try{
    if(typeof localStorage==='undefined')return null;
    const parsed=JSON.parse(localStorage.getItem('godly_kids_data_v6')||'null');
    if(!parsed||typeof parsed!=='object')return null;
    const root=Number.isFinite(parsed.coins)?parsed.coins:null;
    const id=parsed.currentProfileId;
    if(!id)return root;
    const kid=(parsed.kids||[]).find(k=>k&&k.id===id);
    if(!kid)return root;
    const kidCoins=Number.isFinite(kid.coins)?kid.coins:null;
    if(root===null)return kidCoins;
    if(kidCoins===null)return root;
    return Math.min(kidCoins,root);
  }catch{return null;}
}
export function displayCoins(live){
  if(Number.isFinite(live))return live;
  return readShipCoins();
}
