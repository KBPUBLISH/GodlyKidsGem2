export const TREE_MAX_HEALTH=3;
export function treeRemaining(tree,state){return state.removedTrees?.includes(tree.id)?0:Math.max(0,TREE_MAX_HEALTH-(state.treeDamage?.[tree.id]||0));}
export function validTreeDamage(value){return value===undefined||!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(n=>Number.isInteger(n)&&n>0&&n<TREE_MAX_HEALTH);}
export function resourceHealth(current,max){const remaining=Math.max(0,Math.min(max,current));return {current:remaining,max,percent:remaining/max*100,broken:remaining===0};}
