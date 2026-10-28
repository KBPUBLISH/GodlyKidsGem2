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
export function upgradeStatus(state,tier){
  const upgrade=TOOL_TIERS[tier];
  if(!upgrade)return {canCraft:false,missing:[],reason:'Unknown tool tier'};
  const current=toolTier(state).tier;
  const missing=Object.entries(upgrade.recipe).filter(([id,n])=>(state.inventory[id]||0)<n).map(([id,n])=>({id,quantity:n-(state.inventory[id]||0)}));
  return {canCraft:tier===current+1&&!missing.length,missing,reason:tier<=current?'Unlocked':tier>current+1?`Requires ${TOOL_TIERS[tier-1].name} tools`:missing.length?'Gather the remaining materials':'Ready to craft'};
}
