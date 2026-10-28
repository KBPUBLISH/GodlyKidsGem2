// Shovel tiers and what each one lets you dig. Shovels live beside the pickaxe set in `state.tools.shovel`.
// Tier 1 opens the water well; later tiers are reserved for underground builds (storage bunker, tunnels).
import {woodTotal,activeBuildings} from './building.mjs';
export const SHOVEL_TIERS=[
  {tier:0,name:'No shovel',short:'none',color:'#9a8f7d',recipe:{},unlocks:[],blurb:'Make a shovel to start digging.'},
  {tier:1,name:'Wooden shovel',short:'wooden',color:'#b78a52',recipe:{wood:6,stone:3},unlocks:['well'],blurb:'Dig a water well · watering costs no energy',ready:true},
  {tier:2,name:'Copper shovel',short:'copper',color:'#ca8656',recipe:{copper_ore:4,stone:6},unlocks:['bunker'],blurb:'Dig a storage bunker',ready:false,soon:'Storage bunker'},
  {tier:3,name:'Iron shovel',short:'iron',color:'#99adbc',recipe:{iron_ore:6,stone:8},unlocks:['tunnel'],blurb:'Dig tunnels through the hills',ready:false,soon:'Tunnels'},
];
export const shovelLevel=state=>Math.max(0,Math.min(SHOVEL_TIERS.length-1,state.tools?.shovel||0));
export const shovelTier=state=>SHOVEL_TIERS[shovelLevel(state)];
export const hasShovel=state=>shovelLevel(state)>=1;
/** Which shovel tier a building needs; 0 means no shovel. */
export const shovelNeeded=def=>def?.requiresShovel||0;
export const canDig=(state,def)=>shovelLevel(state)>=shovelNeeded(def);
export const haveOf=(state,id)=>id==='wood'?woodTotal(state):(state.inventory?.[id]||0);
export function shovelStatus(state,tier){
  const upgrade=SHOVEL_TIERS[tier];
  if(!upgrade)return {canCraft:false,missing:[],reason:'Unknown shovel'};
  const current=shovelLevel(state);
  const missing=Object.entries(upgrade.recipe).filter(([id,n])=>haveOf(state,id)<n).map(([id,n])=>({id,quantity:n-haveOf(state,id)}));
  if(tier<=current)return {canCraft:false,missing,reason:'Made'};
  if(!upgrade.ready)return {canCraft:false,missing,reason:`Coming soon · ${upgrade.soon}`};
  if(tier>current+1)return {canCraft:false,missing,reason:`Make the ${SHOVEL_TIERS[tier-1].name.toLowerCase()} first`};
  return {canCraft:!missing.length,missing,reason:missing.length?'Gather the remaining materials':'Ready to make'};
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
