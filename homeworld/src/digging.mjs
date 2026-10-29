// Shovel tiers live beside the pickaxe set in `state.tools.shovel`.
// The wooden shovel is instant and opens the water well. Copper and iron shovels
// are forged (one forge job at a time, shared with pick sets) and make Dig faster.
// A shovel still in the forge does not raise `tools.shovel`.
import {woodTotal,activeBuildings} from './building.mjs';
export const SHOVEL_TIERS=[
  {tier:0,name:'No shovel',short:'none',color:'#9a8f7d',recipe:{},unlocks:[],blurb:'Make a shovel to start digging.'},
  {tier:1,name:'Wooden shovel',short:'wooden',color:'#b78a52',recipe:{wood:6,stone:3},unlocks:['well'],blurb:'Dig a water well · watering costs no energy',ready:true},
  {tier:2,name:'Copper shovel',short:'copper',color:'#ca8656',recipe:{copper_ore:3,wood:2},unlocks:[],blurb:'Digs faster',ready:true,forgeDays:.5},
  {tier:3,name:'Iron shovel',short:'iron',color:'#99adbc',recipe:{iron_ore:4,wood:2},unlocks:[],blurb:'Digs fastest',ready:true,forgeDays:1},
];
export const shovelLevel=state=>Math.max(0,Math.min(SHOVEL_TIERS.length-1,state.tools?.shovel||0));
export const shovelTier=state=>SHOVEL_TIERS[shovelLevel(state)];
export const hasShovel=state=>shovelLevel(state)>=1;
/** Which shovel tier a building needs; 0 means no shovel. */
export const shovelNeeded=def=>def?.requiresShovel||0;
export const canDig=(state,def)=>shovelLevel(state)>=shovelNeeded(def);
export const haveOf=(state,id)=>id==='wood'?woodTotal(state):(state.inventory?.[id]||0);
/** Dig strength of the best finished shovel. None and wooden stay the basic Dig. */
export const digPower=state=>{const level=shovelLevel(state);return level>=3?3:level>=2?2:1;};
/** Scales the Dig swing. Copper is quicker than basic; iron is quicker still. */
export const digCycleScale=state=>{const level=shovelLevel(state);return level>=3?.56:level>=2?.77:1;};
/** Island minutes a metal shovel spends in the forge. Wooden is never forged. */
export const shovelForgeMinutes=tier=>(SHOVEL_TIERS[tier]?.forgeDays||0)*1440;
const forgeReady=state=>(state?.buildings||[]).some(b=>b.kind==='forge'&&b.status==='complete');
const forgeBuilding=state=>(state?.buildings||[]).some(b=>b.kind==='forge'&&b.status!=='cancelled'&&b.status!=='complete');
function shovelJob(state){
  const job=state?.tools?.forge;
  if(!job||job.kind!=='shovel'||!Number.isInteger(job.tier)||!Number.isFinite(job.startedAt))return null;
  return job;
}
export function shovelStatus(state,tier){
  const upgrade=SHOVEL_TIERS[tier];
  if(!upgrade)return {canCraft:false,missing:[],reason:'Unknown shovel'};
  const current=shovelLevel(state);
  const missing=Object.entries(upgrade.recipe).filter(([id,n])=>haveOf(state,id)<n).map(([id,n])=>({id,quantity:n-haveOf(state,id)}));
  if(tier<=current)return {canCraft:false,missing,reason:'Made'};
  if(!upgrade.ready)return {canCraft:false,missing,reason:`Coming soon · ${upgrade.soon}`};
  const job=shovelJob(state),anyJob=state?.tools?.forge;
  if(job&&job.tier===tier)return {canCraft:false,missing,forging:true,reason:'Forging at the forge'};
  if(tier>current+1){
    const prev=SHOVEL_TIERS[tier-1];
    if(job&&job.tier===tier-1)return {canCraft:false,missing,busy:true,reason:`The ${prev.name.toLowerCase()} is still in the forge`};
    if(anyJob)return {canCraft:false,missing,busy:true,reason:`Make the ${prev.name.toLowerCase()} first. The forge is busy.`};
    return {canCraft:false,missing,reason:`Make the ${prev.name.toLowerCase()} first`};
  }
  // The wooden shovel is the instant starter. Copper and iron wait on the forge.
  if(tier<=1)return {canCraft:!missing.length,missing,reason:missing.length?'Gather the remaining materials':'Ready to make'};
  if(anyJob)return {canCraft:false,missing,busy:true,reason:'The forge is busy'};
  if(!forgeReady(state)){
    if(forgeBuilding(state))return {canCraft:false,missing,needsForge:true,forgeBuilding:true,reason:'Your forge is still being built'};
    return {canCraft:false,missing,needsForge:true,reason:'Build a forge first'};
  }
  if(missing.length)return {canCraft:false,missing,reason:'Gather the remaining materials'};
  const days=upgrade.forgeDays||0;
  const dayText=days===.5?'half an island day':days===1?'1 island day':`${days} island days`;
  return {canCraft:true,missing,reason:`Ready to forge · ${dayText} (~${days*10} min)`};
}
/** Spend a shovel recipe from the bag; wood comes from any species. Mutates `state`. */
export function spendShovelRecipe(state,tier){
  const inv=state.inventory;
  for(const [id,n] of Object.entries(SHOVEL_TIERS[tier].recipe)){
    if(id==='wood'){let left=n;for(const key of Object.keys(inv).filter(k=>k.endsWith('_wood')).sort()){const take=Math.min(left,inv[key]);inv[key]-=take;left-=take;if(!left)break;}}
    else inv[id]-=n;
  }
}
export const completedWells=state=>activeBuildings(state).filter(b=>b.kind==='well'&&b.status==='complete');
export const hasWell=state=>completedWells(state).length>0;
