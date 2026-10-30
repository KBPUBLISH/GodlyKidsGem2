/**
 * The island journey: Camp → Homestead → Village → Harbour Town (pure rules, no network).
 *
 * settlement.mjs decides what the friends build next; this file decides what the island *is*
 * right now, so the badge, the journey panel and the celebration all agree. People are the
 * headline: a stage is complete when enough people live on the island (POPULATION) and its few
 * secondary milestones (a building or two, food produced, animals) are met. Everything is counted
 * live from the save, so progress ticks over the moment a traveller settles or a well is finished.
 * A stage is reached when it and every stage before it are complete; Camp is the floor.
 *
 * `village.stageReachedAt[stageId] = day` (written by stage-tracker.js) remembers which stages
 * have already been celebrated, so the confetti fires once per stage per island.
 *
 * The user set the ladder and the people targets (Camp 10 · Homestead 20 · Village 40 · Harbour
 * Town 60+); more details can be added to each stage later.
 */
import {activeBuildings,bedCount} from './building.mjs';

const HOME_RANK={tent:0,hut:1,cottage:2,townhouse:3};
const complete=state=>activeBuildings(state).filter(b=>b.status==='complete');
const count=(state,kind)=>complete(state).filter(b=>b.kind===kind).length;
/** Homes at least as good as `minRank` (1 = hut or better; 0 = any roof, tents included). */
const homes=(state,minRank=1)=>complete(state).filter(b=>(HOME_RANK[b.kind]??-1)>=minRank).length;

/* ---- The island's people, pantry and herd (the output side of the journey) ---- */
/** People living on the island: every friend dropped off plus every traveller who settled (state.characters). */
export const population=state=>Object.keys(state?.characters||{}).length;
/** Beds in finished homes (building.mjs `beds`): the ceiling for population until more homes go up. */
export const bedsFor=state=>bedCount(state);
/** Lifetime pieces of food the island produced: a harvest yields three, every fish and every cooked dish counts one, apples picked count one. */
export const foodProduced=state=>{const t=state?.stats||{};return (t.harvested||0)*3+(t.fishCaught||0)+(t.foodPrepared||0)+(t.applesPicked||0);};
/** Farm animals living on the island (placed, not wild visitors like rabbits, crows and snakes). */
export const livestock=state=>(state?.animals||[]).filter(a=>a&&!a.wild&&!String(a.id||'').startsWith('ambient-')).length;

/** Milestone numbers in one place so the panel, the badge, travellers.js and the report agree. */
export const POPULATION={camp:10,homestead:20,village:40,harbour_town:60};
/** Pieces of food the island has to produce. Camp is a real pantry, not a few meals. */
export const FOOD={camp:500,homestead:1200,village:2500,harbour_town:5000};
export const ANIMALS={village:3,harbour_town:6};

const people=(id,hint)=>({id:'people',label:'People living here',short:'People',need:POPULATION[id],have:population,hint:hint||'Welcome travellers so they settle · every settler needs a bed'});
const food=id=>({id:'food',label:'Food produced',short:'Food',need:FOOD[id],have:foodProduced,hint:'Harvest, fish and cook · every piece counts'});
const herd=id=>({id:'animals',label:'Animals',short:'Animals',need:ANIMALS[id],have:livestock,hint:'Coin shop › animals · a stable keeps them safe'});
const building=(kind,label,short,hint,need=1)=>({id:kind,label,short,need,have:s=>count(s,kind),hint});

/**
 * Each stage: id, name, icon (a key for stage-journey.jsx's inline SVGs), a one-line kid-friendly
 * blurb, and the milestone requirements that finish it. `have(state)` is the live count, `short`
 * is the badge label, and `hint` tells the kid where to find the thing when the friends cannot
 * build it for them. People come first in every list because they are the headline.
 */
export const STAGE_LADDER=[
  {id:'camp',name:'Camp',icon:'camp',blurb:'A tent to sleep in, a fire to cook on and ten people around it.',requirements:[
    people('camp','Drop off story friends from the ship · travellers may settle too'),
    {id:'tent',label:'Somewhere to sleep',short:'Roof',need:1,have:s=>homes(s,0),hint:'Build › Homes · Prayer Tent'},
    building('campfire','A campfire','Campfire','Build › Decorations'),
    food('camp'),
  ]},
  {id:'homestead',name:'Homestead',icon:'homestead',blurb:'Twenty people, a real home and a garden to feed them.',requirements:[
    people('homestead'),
    {id:'hut',label:'A Small Hut',short:'Hut',need:1,have:s=>homes(s,1),hint:'Build › Homes · every home adds beds'},
    building('garden','A garden bed','Garden','Build › Gardens'),
    food('homestead'),
  ]},
  {id:'village',name:'Village',icon:'village',blurb:'Forty people, meals together, water close by and a few animals.',requirements:[
    people('village'),
    building('dining_hall','A dining hall','Dining hall','Build › Community'),
    building('well','A water well','Well','Build › Gardens · needs a shovel'),
    food('village'),
    herd('village'),
  ]},
  {id:'harbour_town',name:'Harbour Town',icon:'harbor',blurb:'Sixty people and more, a market by the water and a dock for the boats that bring new friends.',requirements:[
    people('harbour_town'),
    building('market','A market','Market','Build › Community · 2 builders'),
    building('dock','A harbour dock','Dock','Build › Community · 2 builders'),
    food('harbour_town'),
    herd('harbour_town'),
  ]},
];

export const stageById=id=>STAGE_LADDER.find(s=>s.id===id)||null;

function requirementStatus(state,r){
  const have=Math.max(0,r.have(state)|0);
  return {id:r.id,label:r.label,short:r.short||r.label,need:r.need,have:Math.min(have,r.need),done:have>=r.need,hint:r.hint||''};
}
/** The requirement furthest from done (lowest have/need), or null when everything is met. */
export function mostLagging(requirements){
  let worst=null;
  for(const r of requirements){if(r.done)continue;const ratio=r.have/r.need;if(!worst||ratio<worst.ratio)worst={...r,ratio};}
  return worst;
}
export const stageDone=(state,stage)=>stage.requirements.every(r=>r.have(state)>=r.need);

/** Index of the stage the island has reached: every stage up to it is complete. Camp is the floor. */
export function reachedIndex(state){
  let reached=0;
  for(let i=0;i<STAGE_LADDER.length;i++){if(stageDone(state,STAGE_LADDER[i]))reached=i;else break;}
  // Camp is where the island starts even before the tent is up; the next stage only counts once Camp is done.
  return stageDone(state,STAGE_LADDER[0])?reached:0;
}

/**
 * Everything the badge and the journey panel show.
 * {index,total, stage:{id,name,icon,blurb}, stages:[{...,done,current,reachedDay,requirements:[{id,label,short,have,need,done,hint}]}],
 *  next:{...} | null (the first unfinished stage), lagging:{short,have,need,...} | null, island:{people,beds,food,animals}}
 */
export function islandJourney(state){
  const index=reachedIndex(state);
  const reachedAt=state?.village?.stageReachedAt||{};
  const stages=STAGE_LADDER.map((s,i)=>{
    const requirements=s.requirements.map(r=>requirementStatus(state,r));
    const done=requirements.every(r=>r.done);
    return {id:s.id,name:s.name,icon:s.icon,blurb:s.blurb,index:i,done,current:i===index,reachedDay:reachedAt[s.id]??null,requirements};
  });
  const next=stages.find(s=>!s.done)||null;
  const here=stages[index];
  // What the badge whispers: the one thing furthest from the next stage, e.g. "People 4/10".
  const lagging=next?mostLagging(next.requirements):null;
  return {index,total:STAGE_LADDER.length,stage:{id:here.id,name:here.name,icon:here.icon,blurb:here.blurb},stages,next,lagging,
    island:{people:population(state),beds:bedsFor(state),food:foodProduced(state),animals:livestock(state)}};
}

/** Stages reached (per `reachedIndex`) that have not been written into `village.stageReachedAt` yet. */
export function unrecordedStages(state){
  const index=reachedIndex(state),reachedAt=state?.village?.stageReachedAt||{};
  return STAGE_LADDER.slice(0,index+1).filter(s=>reachedAt[s.id]===undefined).map(s=>s.id);
}

/** Recorded stages the island no longer qualifies for (friends sailed away, or the ladder changed): they get celebrated again when re-reached. */
export function staleStages(state){
  const index=reachedIndex(state),reachedAt=state?.village?.stageReachedAt||{};
  return Object.keys(reachedAt).filter(id=>{const i=STAGE_LADDER.findIndex(s=>s.id===id);return i<0||i>index;});
}
/** Island save slice `village` without the `stageReachedAt` entries in `ids` (pure). */
export function forgetStages(village,ids){
  if(!ids.length)return village||{};
  const next={...(village?.stageReachedAt||{})};for(const id of ids)delete next[id];
  return {...(village||{}),stageReachedAt:next};
}
/** Island save slice `village` with `stageReachedAt` marked for `ids` on `day` (pure). */
export function recordStages(village,ids,day){
  if(!ids.length)return village||{};
  const prev=village?.stageReachedAt||{};
  return {...(village||{}),stageReachedAt:{...prev,...Object.fromEntries(ids.map(id=>[id,day]))}};
}

/** Kid-facing line for the celebration toast and the island feed. */
export function stageCelebrationLine(stageId){
  const s=stageById(stageId);if(!s)return '';
  const article=/^[aeiou]/i.test(s.name)?'an':'a';
  return `Your island is now ${article} ${s.name}! ${s.blurb}`;
}
