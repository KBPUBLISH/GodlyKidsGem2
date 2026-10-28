import {activeCharacter,energyFor,LOW_ENERGY,hungerFor,LOW_HUNGER} from './nutrition.mjs';
export const VITALS_PEEK_MS=4000;
export function characterLevels(state,minutes=state.clock.minutes,id=activeCharacter(state)){
 const energy=energyFor(state,id),lowEnergy=energy<=LOW_ENERGY;
 const hunger=Math.round(hungerFor(state,minutes,id)),hungry=hunger<=LOW_HUNGER,starving=hunger<=0;
 return {id,name:state.characters?.[id]?.name||'Adam',energy,lowEnergy,hunger,hungry,starving,pinned:lowEnergy||hungry};
}
export function levelsVisibility(levels,shownUntil=0,now=Date.now()){
 const visible=levels.pinned||now<shownUntil;
 return {visible,opacity:levels.pinned?1:Math.max(0,Math.min(1,(shownUntil-now)/400))};
}
