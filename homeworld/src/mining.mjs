import {SHOVEL_TIERS,shovelForgeMinutes} from './digging.mjs';
export const MINERALS = {
  stone:{name:'Stone',icon:'🪨',color:'#89918b'},
  copper_ore:{name:'Copper ore',icon:'🟠',color:'#bd7947'},
  iron_ore:{name:'Iron ore',icon:'⚙️',color:'#718493'},
  diamond:{name:'Diamond',icon:'💎',color:'#6bcbd1'},
};
export const TOOL_TIERS = [
  {tier:0,name:'Stone',power:1,color:'#78817e',recipe:{}},
  {tier:1,name:'Copper',power:2,color:'#ca8656',recipe:{copper_ore:4,stone:4},find:'copper'},
  {tier:2,name:'Iron',power:3,color:'#99adbc',recipe:{iron_ore:6,stone:5},find:'iron'},
  {tier:3,name:'Diamond',power:5,color:'#79d6df',recipe:{diamond:3,stone:6},find:'diamond'},
];
export const MINING_ENERGY_PER_HIT=5;
export const MINING_SWING_SECONDS=1.05;
export const DEPOSITS={
  stone:{name:'Stone rock',short:'Stone',minTier:0,color:'#89918b'},
  copper:{name:'Copper vein',short:'Copper',minTier:0,color:'#ca8656'},
  iron:{name:'Iron vein',short:'Iron',minTier:1,color:'#99adbc'},
  diamond:{name:'Diamond vein',short:'Diamond',minTier:2,color:'#79d6df'},
};
export function stableHash(id){let h=2166136261;for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export const toolTier=s=>TOOL_TIERS[s.tools?.tier||0];
export const ROCK_REVEAL_MS=2000;
export function rockFindLine(profile){
  const ids=Object.keys(profile?.drops||{});
  const special=['diamond','iron_ore','copper_ore'].filter(id=>ids.includes(id)).map(id=>MINERALS[id].name);
  return special.length?special.join(' · '):'Stone';
}
export function toolNeedMessage(profile){
  const need=(TOOL_TIERS[profile.minTier]?.name||'stronger').toLowerCase();
  const what=profile.deposit==='iron'?'Iron ore':profile.deposit==='copper'?'Copper ore':profile.deposit==='diamond'?'Diamond':'Stone';
  return `${what} needs ${need} tools`;
}
export function rockProfile(rock){
  const hash=stableHash(rock.id),roll=hash%100;
  const deposit=rock.deposit||(roll<44?'stone':roll<74?'copper':roll<93?'iron':'diamond');
  const type=DEPOSITS[deposit];
  const originalHealth=rock.maxHealth||(rock.radius<.35?3:rock.radius<.8?5:7)+({stone:0,copper:1,iron:3,diamond:5}[deposit]);
  // Keep saved damage and fixed loot; fresh rocks take longer than trees at every tool tier.
  const maxHealth=Math.max(6,originalHealth*2);
  const drops=rock.drops?{...rock.drops}:{stone:Math.max(2,Math.ceil(rock.radius*3))};
  if(!rock.drops){
    if(deposit==='copper')drops.copper_ore=2;
    if(deposit==='iron')drops.iron_ore=3;
    if(deposit==='diamond')drops.diamond=1+stableHash(rock.id+':gems')%2;
    // Hidden bonuses stay tied to the rock ID, so reloading cannot reroll them.
    if(deposit==='stone'){
      const bonus=stableHash(rock.id+':hidden')%100;
      if(bonus<6)drops.diamond=1;else if(bonus<24)drops.copper_ore=1;
    }
  }
  return {...type,deposit,maxHealth,drops};
}
export function rockRemaining(rock,state){return state.removedRocks?.includes(rock.id)?0:Math.max(0,rockProfile(rock).maxHealth-(state.rockDamage?.[rock.id]||0));}
/** Island days a metal tier spends in the forge. Stone (tier 0) is never forged. 1 island day = 10 real minutes, same as building projects. */
export const FORGE_DAYS={1:.5,2:1,3:2};
export const forgeMinutes=tier=>(FORGE_DAYS[tier]||0)*1440;
export function forgeEstimate(tier){
  const days=FORGE_DAYS[tier];if(!days)return '';
  const dayText=days===.5?'half an island day':days===1?'1 island day':`${days} island days`;
  return `${dayText} (~${days*10} min)`;
}
/** Same units as a building project: "About N min left", then seconds in the last minute. */
export function forgeTimeLeft(remainingMinutes){
  const approxMin=Math.max(0,remainingMinutes)/1440*10;
  if(approxMin>=1)return `About ${Math.max(1,Math.ceil(approxMin))} min left`;
  const secs=Math.max(1,Math.ceil(approxMin*60));
  return `${secs} ${secs===1?'second':'seconds'} left`;
}
export function forgeJob(state){
  const job=state?.tools?.forge;
  if(!job||!Number.isInteger(job.tier)||!Number.isFinite(job.startedAt))return null;
  return job;
}
export function hasForge(state){return (state?.buildings||[]).some(b=>b.kind==='forge'&&b.status==='complete');}
export function forgeUnderway(state){return (state?.buildings||[]).some(b=>b.kind==='forge'&&b.status!=='cancelled'&&b.status!=='complete');}
export function jobForgeMinutes(job){
  if(!job)return 0;
  if(job.kind==='shovel')return shovelForgeMinutes(job.tier);
  return forgeMinutes(job.tier);
}
export function forgeProgress(state,minutes){
  const job=forgeJob(state);if(!job)return null;
  const total=jobForgeMinutes(job);if(!total)return null;
  const elapsed=Math.max(0,(minutes??0)-job.startedAt),progress=Math.min(1,elapsed/total);
  return {kind:job.kind==='shovel'?'shovel':'tools',tier:job.tier,progress,remaining:Math.max(0,total-elapsed),total,done:progress>=1};
}
/** Keep a finished tool tier exactly as saved. Only a well-formed job for the next tier is kept. */
export function normalizeTools(tools){
  const next={...(tools||{}),tier:Number.isInteger(tools?.tier)?tools.tier:0};
  if(next.shovel!==undefined&&!(Number.isInteger(next.shovel)&&next.shovel>=0&&next.shovel<SHOVEL_TIERS.length))delete next.shovel;
  const job=next.forge;
  const shovelJob=job?.kind==='shovel';
  const owned=shovelJob?(Number.isInteger(next.shovel)?next.shovel:0):next.tier;
  const limit=shovelJob?SHOVEL_TIERS.length:TOOL_TIERS.length;
  const min=shovelJob?2:1;
  const ok=job&&Number.isInteger(job.tier)&&job.tier>=min&&job.tier<limit&&job.tier===owned+1&&Number.isFinite(job.startedAt)&&job.startedAt>=0;
  if(ok)next.forge=shovelJob?{kind:'shovel',tier:job.tier,startedAt:job.startedAt}:{tier:job.tier,startedAt:job.startedAt};
  else delete next.forge;
  return next;
}
export function upgradeStatus(state,tier){
  const upgrade=TOOL_TIERS[tier];
  if(!upgrade)return {canCraft:false,missing:[],reason:'Unknown tool tier'};
  const current=toolTier(state).tier;
  const missing=Object.entries(upgrade.recipe).filter(([id,n])=>(state.inventory[id]||0)<n).map(([id,n])=>({id,quantity:n-(state.inventory[id]||0)}));
  if(tier<=current)return {canCraft:false,missing,reason:'Unlocked'};
  if(tier>current+1){
    const busy=!!(forgeJob(state)&&tier>0);
    return {canCraft:false,missing,busy,reason:busy?`Requires ${TOOL_TIERS[tier-1].name} tools. The forge is busy.`:`Requires ${TOOL_TIERS[tier-1].name} tools`};
  }
  // Stone stays the instant starter. Only the next metal tier waits on the forge.
  if(tier<=0)return {canCraft:!missing.length,missing,reason:missing.length?'Gather the remaining materials':'Ready to craft'};
  const job=forgeJob(state);
  if(job){
    if(job.kind!=='shovel'&&job.tier===tier)return {canCraft:false,missing,forging:true,reason:'Forging at the forge'};
    return {canCraft:false,missing,busy:true,reason:'The forge is busy'};
  }
  if(!hasForge(state)){
    if(forgeUnderway(state))return {canCraft:false,missing,needsForge:true,forgeBuilding:true,reason:'Your forge is still being built'};
    return {canCraft:false,missing,needsForge:true,reason:'Build a forge first'};
  }
  if(missing.length)return {canCraft:false,missing,reason:'Gather the remaining materials'};
  return {canCraft:true,missing,reason:`Ready to forge · ${forgeEstimate(tier)}`};
}
